import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiBookOpen, FiPlus, FiUploadCloud } from 'react-icons/fi';
import API from '../utils/api';
import { getAssetUrl } from '../utils/helpers';
import { usePermissions } from '../context/PermissionContext';
import { Alert, EmptyState, PageHeader, Spinner, StatCard } from '../components/ui';
import ResourceFilters from '../components/resources/ResourceFilters';
import ResourceUploadModal from '../components/resources/ResourceUploadModal';
import ResourceCard from '../components/resources/ResourceCard';
import ResourceDetailModal from '../components/resources/ResourceDetailModal';

const DEFAULT_FILTERS = {
  search: '',
  resourceType: '',
  courseId: '',
  departmentId: '',
  programId: '',
  schoolId: '',
  dateRange: '',
  sort: 'latest',
};

const mapOption = (item) => ({ value: item._id || item.key, label: item.name || item.label });

export default function ResourcesPage() {
  const { can } = usePermissions();
  const [meta, setMeta] = useState({
    courses: [],
    departments: [],
    programs: [],
    schools: [],
    resourceTypes: [],
    sortOptions: [],
    dateOptions: [],
  });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [resources, setResources] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [filtersPrimed, setFiltersPrimed] = useState(false);

  const deferredSearch = useDeferredValue(filters.search);
  const canViewResources = can('view', 'resources');
  const canUpload = can('create', 'resources');
  const canDelete = can('delete', 'resources');

  const filterOptions = useMemo(() => ({
    resourceTypes: (meta.resourceTypes || []).map((item) => ({ value: item.key, label: item.label })),
    courses: (meta.courses || []).map(mapOption),
    departments: (meta.departments || []).map(mapOption),
    programs: (meta.programs || []).map(mapOption),
    schools: (meta.schools || []).map(mapOption),
    sortOptions: (meta.sortOptions || []).map((item) => ({ value: item.key, label: item.label })),
    dateOptions: (meta.dateOptions || []).filter((item) => item.key !== 'all').map((item) => ({ value: item.key, label: item.label })),
  }), [meta]);

  const summary = useMemo(() => {
    const pyqs = resources.filter((item) => item.resourceType === 'pyq').length;
    const notes = resources.filter((item) => item.resourceType === 'notes').length;
    return {
      total: pageInfo.total,
      pyqs,
      notes,
      departments: new Set(resources.map((item) => item.department)).size,
    };
  }, [pageInfo.total, resources]);

  const loadMeta = useCallback(async () => {
    const response = await API.get('/resources/meta');
    setMeta(response.data?.data || {});
  }, []);

  const loadResources = useCallback(async ({ append = false, page = 1, activeFilters } = {}) => {
    const nextFilters = activeFilters || filters;
    const params = {
      ...nextFilters,
      search: nextFilters.search,
      page,
      limit: 12,
    };

    Object.keys(params).forEach((key) => {
      if (params[key] === '') delete params[key];
    });

    const response = await API.get('/resources', { params });
    const data = response.data || {};
    setResources((current) => append ? [...current, ...(data.items || [])] : (data.items || []));
    setPageInfo({
      page: data.page || 1,
      total: data.total || 0,
      hasMore: Boolean(data.hasMore),
    });
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setLoading(true);
      setError('');
      try {
        const [metaResponse, resourceResponse] = await Promise.all([
          API.get('/resources/meta'),
          API.get('/resources', { params: { sort: 'latest', page: 1, limit: 12 } }),
        ]);

        if (cancelled) return;

        setMeta(metaResponse.data?.data || {});
        setResources(resourceResponse.data?.items || []);
        setPageInfo({
          page: resourceResponse.data?.page || 1,
          total: resourceResponse.data?.total || 0,
          hasMore: Boolean(resourceResponse.data?.hasMore),
        });
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Unable to load shared resources right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    if (!filtersPrimed) {
      setFiltersPrimed(true);
      return undefined;
    }

    const handle = window.setTimeout(async () => {
      setRefreshing(true);
      setError('');
      try {
        await loadResources({
          append: false,
          page: 1,
          activeFilters: { ...filters, search: deferredSearch },
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to update the resource list.');
      } finally {
        setRefreshing(false);
      }
    }, 180);

    return () => window.clearTimeout(handle);
  }, [deferredSearch, filters, filtersPrimed, loadResources, ready]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleUpload = async (formData) => {
    setUploading(true);
    try {
      await API.post('/resources', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Resource uploaded successfully');
      await Promise.all([
        loadMeta(),
        loadResources({ append: false, page: 1, activeFilters: { ...filters, search: deferredSearch } }),
      ]);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = (resource) => {
    const fileUrl = buildResourceFileUrl(resource);
    if (!fileUrl) {
      toast.error('This resource file is missing or unavailable.');
      return;
    }

    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async (resource) => {
    const downloadUrl = buildResourceFileUrl(resource, { download: true });
    if (!downloadUrl) {
      toast.error('This resource file is missing or unavailable.');
      return;
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();

    try {
      const response = await API.post(`/resources/${resource._id}/download`);
      const nextCount = response.data?.data?.downloadCount;
      if (typeof nextCount === 'number') {
        setResources((current) => current.map((item) => (
          item._id === resource._id ? { ...item, downloadCount: nextCount } : item
        )));
        setSelectedResource((current) => (
          current?._id === resource._id ? { ...current, downloadCount: nextCount } : current
        ));
      }
    } catch {
      toast.error('The file download started, but we could not update its download count.');
    }
  };

  const handleDelete = async (resource) => {
    const confirmed = window.confirm(`Delete "${resource.title}"?`);
    if (!confirmed) return;

    try {
      await API.delete(`/resources/${resource._id}`);
      toast.success('Resource deleted');
      await loadResources({ append: false, page: 1, activeFilters: { ...filters, search: deferredSearch } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete resource');
    }
  };

  const loadMore = async () => {
    if (!pageInfo.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadResources({
        append: true,
        page: pageInfo.page + 1,
        activeFilters: { ...filters, search: deferredSearch },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load more resources');
    } finally {
      setLoadingMore(false);
    }
  };

  const buildResourceFileUrl = useCallback((resource, { download = false } = {}) => {
    if (!resource?.fileUrl || typeof window === 'undefined') return '';

    const url = new URL(getAssetUrl(resource.fileUrl), window.location.origin);

    if (download) {
      url.searchParams.set('download', '1');
    }

    return url.toString();
  }, []);

  return (
    <div className="flex flex-col gap-5 xl:min-h-[calc(100vh-9rem)] xl:max-h-[calc(100vh-7.75rem)]">
      <PageHeader
        title="Shared Resources"
        description="A central library for notes, previous year questions, and study documents, tagged automatically from the academic structure."
        meta={[
          'Primary navigation under Academic Operations',
          canViewResources ? 'Visibility controlled by the Permissions matrix' : 'Access controlled by the Permissions matrix',
          canUpload ? 'Upload enabled for your role' : 'Browse-only access for your role',
        ]}
        action={(
          canUpload ? (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="btn-primary rounded-2xl px-5 py-3"
            >
              <FiPlus size={16} />
              Upload resource
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Your role can browse resources, but uploading is disabled."
              className="theme-ghost-button inline-flex cursor-not-allowed items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold opacity-70"
            >
              <FiUploadCloud size={16} />
              Upload unavailable
            </button>
          )
        )}
      />

      <div className="grid flex-shrink-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total resources" value={summary.total} icon={<FiBookOpen />} gradient="theme-icon-surface" />
        <StatCard label="Notes loaded" value={summary.notes} icon="📝" gradient="theme-icon-surface" />
        <StatCard label="PYQs visible" value={summary.pyqs} icon="📘" gradient="theme-icon-surface" />
        <StatCard label="Departments covered" value={summary.departments} icon="🏛️" gradient="theme-icon-surface" />
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-stretch">
        <ResourceFilters
          filters={filters}
          onChange={updateFilter}
          onReset={resetFilters}
          filterOptions={filterOptions}
          resultsCount={pageInfo.total}
        />

        <section className="min-w-0 xl:min-h-0">
          <div className="theme-surface relative rounded-[30px] xl:flex xl:h-full xl:flex-col xl:overflow-hidden">
            <div className="theme-surface-soft flex flex-col gap-4 border-b px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">Resource library</p>
                <h2 className="theme-text-strong mt-3 font-display text-2xl font-bold">Browse academic content</h2>
                <p className="theme-text-muted mt-1 text-sm leading-6">
                  Discover shared material through search, course-aware tags, and quick preview actions.
                </p>
              </div>
              <div className="theme-surface rounded-2xl px-4 py-3 text-sm">
                {pageInfo.total} matching resources
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-20 xl:flex xl:min-h-0 xl:flex-1 xl:items-center xl:justify-center">
                <Spinner size="lg" className="mx-auto" />
              </div>
            ) : resources.length ? (
              <>
                <div className={`px-6 pb-2 pt-6 transition-opacity duration-200 xl:min-h-0 xl:flex-1 xl:overflow-y-auto ${refreshing ? 'opacity-70' : 'opacity-100'}`}>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {resources.map((resource) => (
                    <ResourceCard
                      key={resource._id}
                      resource={resource}
                      onOpen={setSelectedResource}
                      onDelete={handleDelete}
                      canDelete={canDelete}
                    />
                  ))}
                  </div>
                </div>

                {pageInfo.hasMore ? (
                  <div className="flex justify-center px-6 pb-6 pt-6">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="theme-ghost-button rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingMore ? 'Loading more...' : 'Load more resources'}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="px-6 py-12 xl:flex xl:min-h-0 xl:flex-1 xl:items-center xl:justify-center">
                <EmptyState
                  icon="📚"
                  title="No resources found"
                  description="Try widening the filters, changing the search terms, or uploading the first document for this course."
                  action={canUpload ? (
                    <button
                      type="button"
                      onClick={() => setUploadOpen(true)}
                      className="btn-primary rounded-2xl px-5 py-3"
                    >
                      Upload the first resource
                    </button>
                  ) : null}
                />
              </div>
            )}

            {refreshing ? (
              <div className="theme-surface-accent pointer-events-none absolute right-5 top-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <Spinner size="sm" />
                Updating results
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <ResourceUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSubmit={handleUpload}
        loading={uploading}
        courses={meta.courses || []}
      />

      <ResourceDetailModal
        open={Boolean(selectedResource)}
        resource={selectedResource}
        onClose={() => setSelectedResource(null)}
        onView={handlePreview}
        onDownload={handleDownload}
      />
    </div>
  );
}

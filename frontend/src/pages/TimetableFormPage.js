import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../utils/api';
import { Alert, FullPageSpinner, PageHeader } from '../components/ui';
import { FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import TimetableEntryForm from '../components/academics/TimetableEntryForm';

export default function TimetableFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [item, setItem] = useState(null);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadFormData = async () => {
      setLoading(true);
      setError('');
      try {
        const requests = [
          API.get('/academics/colleges?paginate=false'),
          API.get('/academics/departments?paginate=false'),
          API.get('/academics/programs?paginate=false'),
          API.get('/academics/courses?paginate=false'),
          API.get('/academics/sections'),
          API.get('/academics/subjects'),
        ];

        if (isEdit) {
          requests.push(API.get(`/academics/timetable/${id}`));
        }

        const [
          collegesRes,
          departmentsRes,
          programsRes,
          coursesRes,
          sectionsRes,
          subjectsRes,
          entryRes,
        ] = await Promise.all(requests);

        if (!mounted) return;

        setColleges(collegesRes.data?.data || []);
        setDepartments(departmentsRes.data?.data || []);
        setPrograms(programsRes.data?.data || []);
        setCourses(coursesRes.data?.data || []);
        setSections(sectionsRes.data?.data || []);
        setSubjects(subjectsRes.data?.data || []);
        setItem(entryRes?.data?.data || null);
      } catch (requestError) {
        if (!mounted) return;
        setError(requestError.response?.data?.message || 'Failed to load timetable form.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadFormData();
    return () => {
      mounted = false;
    };
  }, [id, isEdit]);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isEdit ? 'Edit Timetable Slot' : 'Create Timetable Slot'}
        description={isEdit
          ? 'Update a scheduled class slot with the correct academic scope and timing.'
          : 'Create a timetable slot from a dedicated page so academic scope, section, and faculty stay aligned.'}
        action={(
          <button type="button" onClick={() => navigate('/timetable')} className="btn-secondary">
            <FiArrowLeft size={15} />
            Back to Timetable
          </button>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <TimetableEntryForm
        item={item}
        user={user}
        sections={sections}
        subjects={subjects}
        colleges={colleges}
        departments={departments}
        programs={programs}
        courses={courses}
        onSaved={() => navigate('/timetable')}
        onCancel={() => navigate('/timetable')}
      />
    </div>
  );
}

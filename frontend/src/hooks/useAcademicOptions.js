import { useEffect, useMemo, useState } from 'react';
import API from '../utils/api';
import { buildDepartmentCollegeMap } from '../utils/academicScope';

let cachedOptions = null;
let cachedPromise = null;

export default function useAcademicOptions() {
  const [options, setOptions] = useState({
    colleges: [],
    departments: [],
    programs: [],
    courses: [],
    academicSessions: [],
    sections: [],
  });
  const [loading, setLoading] = useState(!cachedOptions);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      if (cachedOptions) {
        setOptions(cachedOptions);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        cachedPromise = cachedPromise || API.get('/academics/workspace-options');
        const response = await cachedPromise;
        const nextOptions = {
          colleges: response.data?.data?.colleges || [],
          departments: response.data?.data?.departments || [],
          programs: response.data?.data?.programs || [],
          courses: response.data?.data?.courses || [],
          academicSessions: response.data?.data?.academicSessions || [],
          sections: response.data?.data?.sections || [],
        };
        cachedOptions = nextOptions;

        if (!active) return;
        setOptions(nextOptions);
      } catch {
        if (!active) return;
        setOptions({
          colleges: [],
          departments: [],
          programs: [],
          courses: [],
          academicSessions: [],
          sections: [],
        });
      } finally {
        cachedPromise = null;
        if (active) setLoading(false);
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, []);

  const departmentCollegeMap = useMemo(
    () => buildDepartmentCollegeMap(options.departments),
    [options.departments]
  );

  return { options, departmentCollegeMap, loading };
}

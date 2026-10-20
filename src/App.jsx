import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { initHero } from '../js/heroAnimation.js';

const API = '/api';
const initialMessages = [{ role: 'assistant', content: 'Hi. Ask me about a topic, get help with studying, or ask about records available in your account.' }];

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 404) throw new Error(data.error === 'API route not found.' ? `The API server is out of date and does not have ${path}. Restart the API, then refresh this page.` : (data.error || `Route ${path} was not found.`));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function dateLabel(value, timeZone) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...(timeZone ? { timeZone } : {}) }) : 'No due date';
}
function dateTimeLabel(value) {
  return value ? new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No due date';
}
function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A';
}
function displayRole(role) { return role === 'faculty' ? 'Teacher' : role === 'admin' ? 'Administrator' : role; }

function StudentAvatar({ student, token }) {
  const avatarRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    setPhotoUrl('');
    if (!student.photoUpdatedAt) return undefined;
    let active = true;
    let objectUrl = '';
    const controller = new AbortController();
    const loadPhoto = async () => {
      try {
        const response = await fetch(`${API}/students/${encodeURIComponent(student._id)}/photo`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      } catch { /* The initials remain visible if a photo cannot be loaded. */ }
    };
    const target = avatarRef.current;
    let observer;
    if (target && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); void loadPhoto(); }
      }, { rootMargin: '120px' });
      observer.observe(target);
    } else void loadPhoto();
    return () => { active = false; controller.abort(); observer?.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [student._id, student.photoUpdatedAt, token]);

  return <div ref={avatarRef} className="avatar cyan student-avatar" aria-label={`${student.name} profile photo`}>{photoUrl ? <img src={photoUrl} alt=""/> : initials(student.name)}</div>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [tests, setTests] = useState([]);
  const [testQuestions, setTestQuestions] = useState([{ prompt: '', options: ['', '', '', ''], correctOption: 0 }]);
  const [activeTest, setActiveTest] = useState(null);
  const [activeAnswers, setActiveAnswers] = useState([]);
  const [testReport, setTestReport] = useState(null);
  const [testRemaining, setTestRemaining] = useState(0);
  const testAutoSubmitRef = useRef(false);
  const testProgressQueueRef = useRef(Promise.resolve());
  const [attendanceStatuses, setAttendanceStatuses] = useState({});
  const [selectedAttendanceClass, setSelectedAttendanceClass] = useState('');
  const [totalStudents, setTotalStudents] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [view, setView] = useState('overview');
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState('success');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [dataError, setDataError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudentEmail, setSelectedStudentEmail] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhotoBlob, setProfilePhotoBlob] = useState(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [chatInput, setChatInput] = useState('');
  const restoreScrollRef = useRef(null);

  useEffect(() => {
    if (!session?.token) { setProfilePhotoBlob(null); return undefined; }
    let active = true;
    fetch(`${API}/profile/photo`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        if (response.status === 404) { if (active) setProfilePhotoBlob(null); return; }
        if (!response.ok) throw new Error('Could not load profile photo.');
        const blob = await response.blob();
        if (active) setProfilePhotoBlob(blob);
      }).catch(() => { if (active) setProfilePhotoBlob(null); });
    return () => { active = false; };
  }, [session?.token]);

  useEffect(() => {
    if (!profilePhotoBlob) { setProfilePhotoUrl(''); return undefined; }
    const objectUrl = URL.createObjectURL(profilePhotoBlob);
    setProfilePhotoUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [profilePhotoBlob]);

  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    let alive = true;
    const stored = sessionStorage.getItem('aether_session');
    const allowedViews = ['overview', 'students', 'grades', 'fees', 'manage', 'classes', 'attendance', 'assignments', 'tests', 'profile'];
    if (!stored) { setAuthReady(true); return () => { alive = false; }; }
    try {
      const saved = JSON.parse(stored);
      if (!saved.token) throw new Error('Session unavailable');
      api('/auth/me', { token: saved.token }).then(({ user }) => {
        if (!alive) return;
        const savedView = sessionStorage.getItem('aether_view');
        const validViews = ['faculty', 'admin'].includes(user.role) ? allowedViews : ['overview', 'grades', 'fees', 'classes', 'attendance', 'assignments', 'tests', 'profile'];
        const savedScroll = Number(sessionStorage.getItem('aether_scroll_y'));
        setView(validViews.includes(savedView) ? savedView : 'overview');
        restoreScrollRef.current = Number.isFinite(savedScroll) ? Math.max(0, savedScroll) : 0;
        setIntroDone(true);
        setSession({ ...user, token: saved.token });
      }).catch(() => {
        sessionStorage.removeItem('aether_session');
        sessionStorage.removeItem('aether_view');
        sessionStorage.removeItem('aether_scroll_y');
      }).finally(() => { if (alive) setAuthReady(true); });
    } catch {
      sessionStorage.removeItem('aether_session');
      sessionStorage.removeItem('aether_view');
      sessionStorage.removeItem('aether_scroll_y');
      setAuthReady(true);
    }
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!authReady || session) return undefined;
    window.scrollTo({ top: 0, behavior: 'instant' });
    let alive = true;
    const revealLogin = () => {
      setIntroDone(true);
      requestAnimationFrame(() => document.querySelector('#login-view')?.scrollIntoView({ behavior: 'smooth' }));
    };
    const cleanupHero = initHero(() => { if (alive) revealLogin(); });
    document.querySelector('#skip-intro')?.addEventListener('click', revealLogin);
    return () => { alive = false; document.querySelector('#skip-intro')?.removeEventListener('click', revealLogin); cleanupHero?.(); };
  }, [authReady, session]);

  useLayoutEffect(() => {
    document.body.classList.toggle('session-active', Boolean(session));
    return () => document.body.classList.remove('session-active');
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setProfileName(session.name); setProfileEmail(session.email);
  }, [session?.id]);

  useEffect(() => {
    if (!session) return undefined;
    let alive = true;
    let retryDelay = 1000;
    let retryTimer;
    let controller;
    const staff = ['faculty', 'admin'].includes(session.role);
    const load = async () => {
      try {
        const requests = [api('/records', { token: session.token }), api('/notifications', { token: session.token }), api('/classes', { token: session.token }), api('/attendance', { token: session.token }), api('/assignments', { token: session.token }), api('/tests', { token: session.token })];
        if (staff) requests.push(api('/students', { token: session.token }));
        const [recordData, notificationData, classData, attendanceData, assignmentData, testData, studentData] = await Promise.all(requests);
        if (!alive) return;
        setRecords(recordData.records);
        setNotifications(notificationData.notifications);
        setClasses(classData.classes); setAttendance(attendanceData.attendance); setAssignments(assignmentData.assignments);
        setTests(testData.tests);
        if (studentData) { setStudents(studentData.students); setTotalStudents(studentData.totalStudents); }
        setLastSyncedAt(new Date());
        setDataError('');
        if (restoreScrollRef.current !== null) {
          const restoreTo = restoreScrollRef.current;
          restoreScrollRef.current = null;
          requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: restoreTo, behavior: 'instant' })));
        }
      } catch (error) { if (alive) setDataError(error.message); }
    };
    const connect = async () => {
      controller = new AbortController();
      try {
        const response = await fetch(`${API}/events`, { headers: { Authorization: `Bearer ${session.token}` }, signal: controller.signal });
        if (!response.ok || !response.body) throw new Error('Live updates unavailable');
        setLiveConnected(true);
        retryDelay = 1000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (alive) {
          const { value, done } = await reader.read();
          if (done) throw new Error('Live connection closed');
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() || '';
          if (blocks.some((block) => /^event: refresh\s*$/m.test(block))) void load();
        }
      } catch {
        if (!alive) return;
        setLiveConnected(false);
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
      }
    };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void load(); };
    void load(); void connect();
    const fallback = setInterval(load, 30000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      alive = false; clearInterval(fallback); clearTimeout(retryTimer); controller?.abort();
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [session?.token, session?.role]);

  useEffect(() => {
    if (!session) return undefined;
    const savePosition = () => {
      sessionStorage.setItem('aether_view', view);
      sessionStorage.setItem('aether_scroll_y', String(window.scrollY));
    };
    window.addEventListener('scroll', savePosition, { passive: true });
    window.addEventListener('pagehide', savePosition);
    savePosition();
    return () => { window.removeEventListener('scroll', savePosition); window.removeEventListener('pagehide', savePosition); };
  }, [session, view]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!activeTest || testReport) return undefined;
    const deadline = Math.min(Date.parse(activeTest.attempt.startedAt) + activeTest.durationMinutes * 60_000, Date.parse(activeTest.closesAt));
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTestRemaining(seconds);
      if (seconds === 0 && !testAutoSubmitRef.current) { testAutoSubmitRef.current = true; void finishTest(activeAnswers); }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTest, activeAnswers, testReport]);

  const unread = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);
  const isStaff = Boolean(session && ['faculty', 'admin'].includes(session.role));
  const grades = records.filter((record) => record.category === 'grade');
  const fees = records.filter((record) => record.category === 'fee');
  const pendingFees = fees.filter((record) => record.status === 'pending');
  const filteredStudents = students.filter((student) => `${student.name} ${student.email}`.toLowerCase().includes(studentQuery.trim().toLowerCase()));
  const navItems = isStaff
    ? [['◫', 'Overview', 'overview'], ['♙', 'Students', 'students'], ['▦', 'Classes', 'classes'], ['✓', 'Attendance', 'attendance'], ['▤', 'Assignments', 'assignments'], ['◧', 'Tests', 'tests'], ['▤', 'Grades', 'grades'], ['◈', 'Fees', 'fees'], ['＋', 'Add records', 'manage']]
    : [['◫', 'Overview', 'overview'], ['▦', 'My classes', 'classes'], ['✓', 'Attendance', 'attendance'], ['▤', 'Assignments', 'assignments'], ['◧', 'Tests', 'tests'], ['▤', 'Grades', 'grades'], ['◈', 'Fees', 'fees']];
  const viewTitle = view === 'overview' ? `Welcome, ${session?.name?.split(' ')[0] || ''}.`
    : view === 'students' ? 'Student directory.'
    : view === 'tests' ? 'Tests and report cards.'
    : view === 'classes' ? 'Classes and rosters.'
      : view === 'attendance' ? 'Attendance.'
        : view === 'assignments' ? 'Assignments.'
          : view === 'profile' ? 'Your profile.'
    : view === 'manage' ? 'Academic records.'
        : view === 'fees' ? (isStaff ? 'Fee management.' : 'Fee account.')
          : (isStaff ? 'Published grades.' : 'Your grades.');
  const viewDescription = view === 'students' ? 'Find a student and post an update directly to their academic account.'
    : view === 'classes' ? 'Manage class groups and their enrolled student rosters.'
      : view === 'attendance' ? 'Record and review dated attendance for your classes.'
        : view === 'assignments' ? 'Publish class work, track submissions, and see due dates.'
          : view === 'tests' ? 'Take timed assessments and review secure, automatically scored report cards.'
          : view === 'profile' ? 'Keep your name and sign-in email up to date.'
    : view === 'manage' ? 'Save a fee reminder or publish a grade. Students see the change immediately.'
      : isStaff ? 'Class records, fee follow-ups, and student updates in one live workspace.'
        : 'Your account data and notifications are kept up to date.';

  function flash(message, kind = 'success') { setNotice(message); setNoticeKind(kind); }
  function navigate(nextView) { setView(nextView); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function handleAuth(event) {
    event.preventDefault(); setLoginError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = registering
      ? { name: String(form.get('name') || '').trim(), email: String(form.get('email') || '').trim(), password: String(form.get('password') || '') }
      : { email: String(form.get('email') || '').trim(), password: String(form.get('password') || '') };
    try {
      const { user, token } = await api(registering ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      const next = { ...user, token };
      sessionStorage.setItem('aether_session', JSON.stringify(next));
      sessionStorage.setItem('aether_view', 'overview'); sessionStorage.setItem('aether_scroll_y', '0');
      setView('overview'); restoreScrollRef.current = null; setSession(next); setIntroDone(true);
      window.scrollTo({ top: 0, behavior: 'instant' }); flash(`Welcome, ${user.name}.`);
    } catch (error) { setLoginError(error.message); }
    finally { setBusy(false); }
  }

  async function updateProfile(event) {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget;
    const currentPassword = new FormData(form).get('currentPassword');
    try {
      const { user } = await api('/profile', { token: session.token, method: 'PATCH', body: JSON.stringify({ name: profileName, email: profileEmail, currentPassword }) });
      const updatedSession = { ...session, ...user };
      sessionStorage.setItem('aether_session', JSON.stringify(updatedSession));
      setSession(updatedSession); setProfileName(user.name); setProfileEmail(user.email);
      form.reset(); flash('Profile updated. Use your new email address the next time you sign in.');
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function updateProfilePhoto(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get('photo');
    if (!(file instanceof File) || !file.size) { flash('Choose a photo to upload.', 'error'); return; }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/webp'].includes(file.type.toLowerCase())) { flash('Choose a PNG, JPEG, or WebP image.', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { flash('Profile photos must be 2 MB or smaller.', 'error'); return; }
    setBusy(true);
    try {
      await api('/profile/photo', { token: session.token, method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      const uploadedPhoto = await fetch(`${API}/profile/photo`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (!uploadedPhoto.ok) throw new Error('The photo was saved, but the preview could not be refreshed.');
      setProfilePhotoBlob(await uploadedPhoto.blob());
      form.reset();
      flash('Profile photo updated.');
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  function signOut() {
    sessionStorage.removeItem('aether_session'); sessionStorage.removeItem('aether_view'); sessionStorage.removeItem('aether_scroll_y');
    setSession(null); setRecords([]); setStudents([]); setTotalStudents(0); setNotifications([]); setTests([]); setTestQuestions([{ prompt: '', options: ['', '', '', ''], correctOption: 0 }]); setActiveTest(null); setActiveAnswers([]); setTestReport(null);
    setAssistantOpen(false); setNotificationsOpen(false); setView('overview'); setMessages(initialMessages);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function refreshData() {
    const requests = [api('/records', { token: session.token }), api('/notifications', { token: session.token }), api('/classes', { token: session.token }), api('/attendance', { token: session.token }), api('/assignments', { token: session.token }), api('/tests', { token: session.token })];
    if (isStaff) requests.push(api('/students', { token: session.token }));
    const [recordData, notificationData, classData, attendanceData, assignmentData, testData, studentData] = await Promise.all(requests);
    setRecords(recordData.records); setNotifications(notificationData.notifications);
    setClasses(classData.classes); setAttendance(attendanceData.attendance); setAssignments(assignmentData.assignments);
    setTests(testData.tests);
    if (studentData) { setStudents(studentData.students); setTotalStudents(studentData.totalStudents); }
    setLastSyncedAt(new Date()); setDataError('');
  }

  async function createAcademicRecord(event, kind) {
    event.preventDefault(); setBusy(true);
    const formElement = event.currentTarget;
    const payload = Object.fromEntries(new FormData(formElement).entries());
    try {
      const { record } = await api(`/records/${kind}`, { token: session.token, method: 'POST', body: JSON.stringify(payload) });
      await refreshData(); formElement.reset(); setSelectedStudentEmail('');
      const emailStatus = { queued: 'email queued', sent: 'email accepted by the provider', failed: 'email delivery failed; check the server logs', not_configured: 'email is not configured' }[record.notification?.emailStatus] || 'email status unavailable';
      flash(`${kind === 'fee' ? 'Fee reminder' : 'Grade'} saved and in-app notice created. Email: ${emailStatus}.`);
      navigate('overview');
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function createClass(event) {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const studentEmails = data.getAll('studentEmails');
    try {
      await api('/classes', { token: session.token, method: 'POST', body: JSON.stringify({ name: data.get('name'), subject: data.get('subject'), studentEmails }) });
      await refreshData(); form.reset(); flash('Class and roster saved.');
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function addStudentsToClass(event, room) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true);
    const studentIds = new FormData(form).getAll('studentIds');
    try {
      const result = await api(`/classes/${room._id}/students`, { token: session.token, method: 'PATCH', body: JSON.stringify({ studentIds }) });
      await refreshData(); form.reset(); flash(result.message);
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function saveAttendance(event) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true);
    const data = new FormData(form); const classId = data.get('classId');
    const room = classes.find((item) => item._id === classId);
    if (!room) { setBusy(false); flash('Choose a class first.', 'error'); return; }
    const entries = room.students.map((student) => ({ studentId: student._id, status: attendanceStatuses[student._id] || 'present' }));
    try {
      const { saved } = await api('/attendance', { token: session.token, method: 'POST', body: JSON.stringify({ classId, date: data.get('date'), entries }) });
      await refreshData(); flash(`Attendance saved for ${saved} students.`);
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function createAssignment(event) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true);
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.dueTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const dueAt = new Date(payload.dueAt);
    if (Number.isNaN(dueAt.getTime())) { setBusy(false); flash('Choose a valid assignment deadline.', 'error'); return; }
    payload.dueAt = dueAt.toISOString();
    try { await api('/assignments', { token: session.token, method: 'POST', body: JSON.stringify(payload) }); await refreshData(); form.reset(); flash('Assignment published and students notified.'); }
    catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function createTest(event) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true);
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      payload.opensAt = new Date(payload.opensAt).toISOString(); payload.closesAt = new Date(payload.closesAt).toISOString();
      payload.durationMinutes = Number(payload.durationMinutes);
      payload.questions = testQuestions;
      const { emailDelivery = {} } = await api('/tests', { token: session.token, method: 'POST', body: JSON.stringify(payload) });
      await refreshData(); form.reset(); setTestQuestions([{ prompt: '', options: ['', '', '', ''], correctOption: 0 }]);
      const queued = emailDelivery.queued || 0; const notConfigured = emailDelivery.not_configured || 0; const failed = emailDelivery.failed || 0;
      const emailSummary = queued ? `${queued} student email${queued === 1 ? '' : 's'} queued for delivery.${failed ? ` ${failed} could not be queued; check the server logs.` : ''}`
        : notConfigured ? 'Email is not configured, so students will only see the in-app notice.'
          : failed ? 'Student email could not be queued; check the server logs.'
            : 'No students are enrolled in this class.';
      flash(`Test published. ${emailSummary}`, failed ? 'error' : 'success');
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function startTest(test) {
    setBusy(true);
    try {
      const { test: testData, attempt } = await api(`/tests/${test._id}/start`, { token: session.token, method: 'POST', body: JSON.stringify({}) });
      testAutoSubmitRef.current = false;
      if (attempt.submittedAt) {
        const byId = new Map((attempt.answers || []).map((answer) => [String(answer.question), answer.selectedOption]));
        setTestReport({ ...attempt, title: test.title, questions: testData.questions.map((question) => ({ ...question, selectedOption: byId.get(String(question._id)), isCorrect: byId.get(String(question._id)) === question.correctOption })) });
      } else {
        setTestReport(null); setActiveAnswers(testData.questions.map((question) => (attempt.answers || []).find((answer) => String(answer.question) === String(question._id))?.selectedOption ?? null));
      }
      setActiveTest({ ...testData, attempt });
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function persistTestAnswers(test, answers) {
    testProgressQueueRef.current = testProgressQueueRef.current.catch(() => {}).then(() => api(`/tests/${test._id}/progress`, { token: session.token, method: 'PUT', body: JSON.stringify({ answers }) }));
    try { await testProgressQueueRef.current; }
    catch (error) { flash(error.message, 'error'); }
  }

  async function finishTest(answers = activeAnswers) {
    if (!activeTest || testReport || busy) return;
    setBusy(true);
    try {
      await testProgressQueueRef.current.catch(() => {});
      const { report } = await api(`/tests/${activeTest._id}/submit`, { token: session.token, method: 'POST', body: JSON.stringify({ answers }) });
      setTestReport(report); await refreshData();
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function submitAssignment(event, assignment) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true);
    const text = new FormData(form).get('text');
    try { await api(`/assignments/${assignment._id}/submit`, { token: session.token, method: 'POST', body: JSON.stringify({ text }) }); await refreshData(); flash('Assignment submission saved.'); }
    catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function removeStudent(student) {
    const confirmed = window.confirm(`Permanently delete ${student.name}'s account, profile photo, and notifications from the database? This removes their class enrollment. Grade, fee, attendance, and submitted assignment history will be retained.`);
    if (!confirmed) return;
    setBusy(true);
    try {
      const result = await api(`/students/${student._id}`, { token: session.token, method: 'DELETE' });
      await refreshData();
      if (selectedStudentEmail === student.email) setSelectedStudentEmail('');
      flash(result.message || 'Student account permanently deleted.');
    } catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function markRead(notification) {
    if (notification.readAt) return;
    try {
      const { notification: updated } = await api(`/notifications/${notification._id}/read`, { token: session.token, method: 'PATCH' });
      setNotifications((items) => items.map((item) => item._id === updated._id ? updated : item));
    } catch (error) { flash(error.message, 'error'); }
  }

  async function settleFee(record) {
    setBusy(true);
    try { await api(`/records/${record._id}/settle`, { token: session.token, method: 'PATCH' }); await refreshData(); flash(`Marked “${record.title}” as settled.`); }
    catch (error) { flash(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function sendChat(event) {
    event.preventDefault(); const text = chatInput.trim(); if (!text || busy) return;
    const nextMessages = [...messages.slice(-22), { role: 'user', content: text }]; setMessages([...nextMessages, { role: 'assistant', content: '…' }]); setChatInput(''); setBusy(true);
    try {
      const { reply } = await api('/chat', { token: session.token, method: 'POST', body: JSON.stringify({ messages: nextMessages.slice(-24) }) });
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
    } catch (error) { setMessages([...nextMessages, { role: 'assistant', content: error.message }]); }
    finally { setBusy(false); }
  }

  if (!authReady) return <div className="startup-screen" role="status">Restoring your workspace…</div>;

  return <>
    {!session && <>
      <main className={`scroll-sequence ${introDone ? 'intro-finished' : ''}`} aria-label="Aether Academy introduction">
        <div className="hero-pin"><canvas id="hero-canvas" aria-hidden="true" />
          <div className="hero-copy"><img className="hero-brand-icon" src="/brand/aether-academy-icon.png" alt=""/><span className="hero-kicker">AETHER ACADEMY</span><strong>One workspace for every academic decision.</strong></div>
          <div className="hero-hint">SCROLL TO ENTER <span>↓</span></div><button id="skip-intro" className="skip-intro" type="button">Skip intro</button>
        </div>
      </main>
      <section id="login-view" className={`login-view ${introDone ? '' : 'view-hidden'}`} aria-labelledby="login-title">
        <div className="login-ambient" aria-hidden="true"><i className="ambient-orb orb-cyan"/><i className="ambient-orb orb-purple"/><i className="ambient-orb orb-blue"/></div><div className="ambient-glow ambient-bg"/>
        <div className="login-form-panel"><div className="login-card glass-card">
          <div className="brand-mark"><img src="/brand/aether-academy-logo.png" alt="Aether Academy" /></div><p className="eyebrow">AETHER ACADEMY / SECURE ACCESS</p>
          <h1 id="login-title">{registering ? 'Create your account.' : 'Welcome back.'}</h1><p className="muted">Sign in to your academic workspace.</p>
          <form onSubmit={handleAuth}>
            {registering && <><label className="field-label" htmlFor="name">FULL NAME</label><input id="name" name="name" autoComplete="name" required minLength="2" maxLength="100" /></>}
            <label className="field-label" htmlFor="email">EMAIL ADDRESS</label><input id="email" name="email" type="email" placeholder="you@school.edu" autoComplete="username" required />
            <label className="field-label" htmlFor="password">PASSWORD</label><input id="password" name="password" type="password" placeholder={registering ? 'At least 12 characters' : 'Password'} autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 12 : undefined} required />
            {loginError && <p className="field-error" role="alert">{loginError}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create student account' : 'Sign in'} <span>→</span></button>
          </form>
          <p className="demo-hint">Students, teachers, and school admins use this same sign-in. Staff accounts are managed by a school administrator.<br/><button className="auth-mode-toggle" type="button" onClick={() => { setRegistering(!registering); setLoginError(''); }}>{registering ? 'Back to sign in' : 'Create a student account'}</button></p>
        </div></div>
      </section>
    </>}

    {session && <section id="app-view" className="app-view">
      <div className="ambient-glow"/>
      <aside className="sidebar glass-card"><div className="logo"><img className="brand-symbol" src="/brand/aether-academy-icon.png" alt=""/><div>AETHER<small>ACADEMY OS</small></div></div>
        <div className="profile-mini"><button className="avatar cyan avatar-button" aria-label="Open your profile" onClick={() => navigate('profile')}>{profilePhotoUrl ? <img src={profilePhotoUrl} alt=""/> : initials(session.name)}</button><div><strong>{session.name}</strong><small>{displayRole(session.role).toUpperCase()}</small></div><button aria-label="Sign out" onClick={signOut}>⋮</button></div>
        <nav>{navItems.map(([icon, label, key]) => <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => navigate(key)}><span>{icon}</span>{label}</button>)}{!isStaff && <button className={`nav-item ${view === 'profile' ? 'active' : ''}`} onClick={() => navigate('profile')}><span>○</span>Profile</button>}</nav>
        <div className="sidebar-foot"><button onClick={() => setAssistantOpen(true)}>◈ <span>Ask Aether AI</span></button><button onClick={signOut}>↪ <span>Sign out</span></button></div>
      </aside>
      <div className="workspace"><header className="topbar"><button className="mobile-menu" aria-label="Open menu">☰</button><div className="topbar-spacer"/><div className="top-actions"><button className="notification-trigger" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>♢{unread > 0 && <span className="notification-count">{unread}</span>}</button><button className="avatar purple avatar-button" aria-label="Open your profile" onClick={() => { setNotificationsOpen(false); navigate('profile'); }}>{profilePhotoUrl ? <img src={profilePhotoUrl} alt=""/> : initials(session.name)}</button></div>
        {notificationsOpen && <div className="notification-popover glass-card"><div className="popover-heading"><strong>Notifications</strong><button onClick={() => setNotificationsOpen(false)}>×</button></div>{notifications.length ? notifications.map((item) => <button key={item._id} className={`notification-item ${item.readAt ? '' : 'unread'}`} onClick={() => markRead(item)}><strong>{item.subject}</strong><span>{item.message}</span><small>{dateLabel(item.createdAt)} · Email {item.emailStatus?.replace('_', ' ')}</small></button>) : <p className="muted">You’re all caught up.</p>}</div>}
      </header>
      <main className="dashboard-content">
        <div className="dashboard-header"><div><p className="status"><span className="live-dot">●</span> SECURE ACADEMIC WORKSPACE <small className="sync-status">{liveConnected ? 'LIVE' : 'RECONNECTING'}{lastSyncedAt ? ` · UPDATED ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</small></p><h1>{viewTitle}</h1><p className="muted">{viewDescription}</p></div><div className="dashboard-actions"><button className="secondary-button" onClick={() => refreshData().catch((error) => flash(error.message, 'error'))}>Refresh</button><button className="primary-button dashboard-ai" onClick={() => setAssistantOpen(true)}>Ask Aether AI <span>→</span></button></div></div>
        {dataError && <div className="data-error" role="alert">Could not refresh data: {dataError}</div>}
        {view === 'profile' ? <><section className="card glass-card profile-card"><p className="eyebrow">ACCOUNT / PERSONAL DETAILS</p><h3>Your profile photo</h3><p className="muted">Add a photo so your account is easy to recognize.</p><form className="photo-upload-form" onSubmit={updateProfilePhoto}><div className="profile-photo-preview avatar cyan">{profilePhotoUrl ? <img src={profilePhotoUrl} alt="Your current profile"/> : initials(session.name)}</div><label>Choose a photo<input name="photo" type="file" accept="image/png,image/jpeg,image/webp" required/></label><small className="muted">PNG, JPEG, or WebP · up to 2 MB</small><button className="secondary-button" disabled={busy}>Upload photo</button></form></section><section className="card glass-card profile-card"><p className="eyebrow">ACCOUNT / PERSONAL DETAILS</p><h3>Edit your profile</h3><p className="muted">Keep your account information current. Your email is also your sign-in address.</p><form className="record-form" onSubmit={updateProfile}><label>Full name<input name="name" autoComplete="name" minLength="2" maxLength="100" required value={profileName} onChange={(event) => setProfileName(event.target.value)}/></label><label>Email address<input name="email" type="email" autoComplete="email" maxLength="254" required value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)}/></label><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required/></label><small className="muted profile-security-note">Enter your current password to confirm these changes. If you change your email, the new address takes effect immediately for sign-in and future notifications.</small><button className="primary-button" disabled={busy}>Save profile →</button></form></section></>
          : view === 'classes' ? <div className="grid two records-grid">
          {isStaff && <article className="card glass-card"><p className="eyebrow">ACADEMIC SETUP</p><h3>Create a class</h3><form className="record-form" onSubmit={createClass}><label>Class name<input name="name" required maxLength="100" placeholder="Grade 8 · Section A"/></label><label>Subject<input name="subject" required maxLength="100" placeholder="Mathematics"/></label><label>Enroll students<select name="studentEmails" multiple size="6">{students.map((student) => <option key={student._id} value={student.email}>{student.name} · {student.email}</option>)}</select></label><small className="muted">Use Ctrl/Cmd to select multiple students. Teacher accounts own classes they create.</small><button className="primary-button" disabled={busy}>Save class and roster →</button></form></article>}
          <article className="card glass-card"><div className="section-title"><h3>{isStaff ? 'Your classes' : 'Enrolled classes'}</h3><span className="badge">{classes.length} CLASSES</span></div>{classes.length ? <div className="list">{classes.map((room) => { const enrolled = new Set(room.students.map((student) => student._id)); const available = students.filter((student) => !enrolled.has(student._id)); return <div className="class-roster-block" key={room._id}><div className="list-row record-row"><div><strong>{room.name}</strong><span>{room.subject} · {room.students.length} students{room.teacher?.name ? ` · Teacher ${room.teacher.name}` : ''}</span></div></div>{room.students.length > 0 && <p className="class-roster-names">{room.students.map((student) => student.name).join(' · ')}</p>}{isStaff && <form className="enroll-students-form" onSubmit={(event) => addStudentsToClass(event, room)}><label htmlFor={`enroll-${room._id}`}>Add students to this class</label><div className="enroll-students-controls"><select id={`enroll-${room._id}`} name="studentIds" multiple size="4" disabled={!available.length} aria-label={`Select students to add to ${room.name}`}>{available.map((student) => <option key={student._id} value={student._id}>{student.name} · {student.email}</option>)}</select><button className="secondary-button" type="submit" disabled={busy || !available.length}>{available.length ? 'Add selected' : 'All active students enrolled'}</button></div>{available.length > 0 && <small className="muted">Select one or more students; use Ctrl/Cmd for multiple.</small>}</form>}</div>; })}</div> : <p className="empty-state">{isStaff ? 'Create a class and enroll students to start taking attendance or publishing work.' : 'You have not been enrolled in a class yet.'}</p>}</article>
        </div> : view === 'attendance' ? <div className="grid two records-grid">
          {isStaff && <article className="card glass-card"><p className="eyebrow">DAILY ROLL CALL</p><h3>Take attendance</h3><form className="record-form" onSubmit={saveAttendance}><label>Class<select name="classId" required value={selectedAttendanceClass} onChange={(event) => { setSelectedAttendanceClass(event.target.value); setAttendanceStatuses({}); }}><option value="">Choose a class</option>{classes.map((room) => <option key={room._id} value={room._id}>{room.name} · {room.subject}</option>)}</select></label><label>Date<input name="date" type="date" defaultValue={localDateInputValue()} required/></label>{selectedAttendanceClass && <label>Roster statuses{classes.find((room) => room._id === selectedAttendanceClass)?.students.length === 0 && <small className="muted">Enroll students in Classes first.</small>}</label>}{classes.find((room) => room._id === selectedAttendanceClass)?.students.map((student) => <div className="student-row" key={student._id}><strong className="student-identity">{student.name}</strong><select aria-label={`${student.name} attendance`} value={attendanceStatuses[student._id] || 'present'} onChange={(event) => setAttendanceStatuses((state) => ({ ...state, [student._id]: event.target.value }))}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></div>)}<button className="primary-button" disabled={busy || !classes.find((room) => room._id === selectedAttendanceClass)?.students.length}>Save attendance →</button></form></article>}
          <article className="card glass-card"><div className="section-title"><h3>{isStaff ? 'Recent attendance' : 'My attendance'}</h3><span className="badge">{attendance.length} ENTRIES</span></div>{attendance.length ? <div className="list">{attendance.map((entry) => <div className="list-row record-row" key={entry._id}><div><strong>{entry.class?.name || 'Class'}</strong><span>{entry.student?.name ? `${entry.student.name} · ` : ''}{dateLabel(entry.date, 'UTC')}</span></div><b className={entry.status === 'absent' ? 'pending-text' : ''}>{entry.status}</b></div>)}</div> : <p className="empty-state">Attendance will appear here once it is recorded.</p>}</article>
        </div> : view === 'assignments' ? <div className="grid two records-grid">
          {isStaff && <article className="card glass-card"><p className="eyebrow">CLASSWORK</p><h3>Publish assignment</h3><form className="record-form" onSubmit={createAssignment}><label>Class<select name="classId" required><option value="">Choose a class</option>{classes.map((room) => <option key={room._id} value={room._id}>{room.name} · {room.subject}</option>)}</select></label><label>Title<input name="title" required maxLength="140" placeholder="Chapter 4 practice"/></label><label>Instructions<textarea name="instructions" rows="4" maxLength="3000" placeholder="What students need to complete"/></label><label>Due date<input name="dueAt" type="datetime-local" required/></label><button className="primary-button" disabled={busy || !classes.length}>Publish and notify →</button></form></article>}
          <section className="assignment-list">{assignments.length ? assignments.map((item) => { const own = item.submissions.find((entry) => String(entry.student?._id || entry.student) === session.id); return <article className="card glass-card assignment-card" key={item._id}><p className="eyebrow">{item.class?.name || 'CLASS'} · DUE {dateTimeLabel(item.dueAt)}</p><h3>{item.title}</h3><p className="muted">{item.instructions || 'No extra instructions.'}</p>{isStaff ? <div className="submission-list"><strong>{item.submissions.length} submissions</strong>{item.submissions.map((submission) => <p key={submission._id || submission.student?._id}>{submission.student?.name}: {submission.text}</p>)}</div> : <form className="record-form" onSubmit={(event) => submitAssignment(event, item)}><label>Your response<textarea name="text" required maxLength="5000" rows="4" defaultValue={own?.text || ''} placeholder="Write your response"/></label><small className="muted">{own ? `Submitted ${dateLabel(own.submittedAt)} · You can update your response.` : 'Not submitted yet'}</small><button className="primary-button" disabled={busy}>Save submission →</button></form>}</article>; }) : <article className="card glass-card"><p className="empty-state">No assignments have been published to your classes yet.</p></article>}</section>
        </div> : view === 'tests' ? (activeTest ? <section className="card glass-card test-session-card">
          <div className="test-session-top"><button className="secondary-button" onClick={() => { setActiveTest(null); setTestReport(null); }}>← Back to tests</button>{!testReport && <div className={`test-timer ${testRemaining < 300 ? 'urgent' : ''}`}><span>TIME REMAINING</span><strong>{String(Math.floor(testRemaining / 60)).padStart(2, '0')}:{String(testRemaining % 60).padStart(2, '0')}</strong></div>}</div>
          {testReport ? <div className="report-card"><div className="report-heading"><div><p className="eyebrow">ASSESSMENT REPORT</p><h2>{testReport.title || activeTest.title}</h2><p className="muted">Submitted {dateTimeLabel(testReport.submittedAt)}</p></div><div className="score-circle"><strong>{testReport.percentage}%</strong><span>COMPLETE</span></div></div><div className="report-stats"><div><span>Score</span><strong>{testReport.score} / {testReport.total}</strong></div><div><span>Percentage</span><strong>{testReport.percentage}%</strong></div><div><span>Status</span><strong>Submitted</strong></div></div><h3>Question review</h3><div className="question-review">{testReport.questions.map((question, index) => <article key={question._id} className={`review-question ${question.isCorrect ? 'correct' : 'incorrect'}`}><div className="review-question-title"><strong>Question {index + 1}</strong><span>{question.isCorrect ? 'Correct' : 'Review'}</span></div><p>{question.prompt}</p><small>Your answer: {question.selectedOption == null ? 'Not answered' : question.options[question.selectedOption]}</small>{!question.isCorrect && <small>Correct answer: {question.options[question.correctOption]}</small>}</article>)}</div></div>
          : <><p className="eyebrow">{activeTest.class?.name || 'ASSESSMENT'} · {activeTest.questions.length} QUESTIONS · {activeTest.durationMinutes} MINUTES</p><h2>{activeTest.title}</h2><p className="muted">{activeTest.instructions || 'Choose one answer for each question. Your progress is saved as you go.'}</p><form className="test-question-form" onSubmit={(event) => { event.preventDefault(); if (window.confirm('Submit this test now? You cannot change answers after submission.')) void finishTest(); }}>{activeTest.questions.map((question, index) => <fieldset className="test-question" key={question._id}><legend><span>QUESTION {String(index + 1).padStart(2, '0')}</span>{question.prompt}</legend><div className="test-options">{question.options.map((option, choiceIndex) => <label key={choiceIndex} className={activeAnswers[index] === choiceIndex ? 'selected' : ''}><input type="radio" name={`test-${question._id}`} checked={activeAnswers[index] === choiceIndex} onChange={() => { const next = [...activeAnswers]; next[index] = choiceIndex; setActiveAnswers(next); void persistTestAnswers(activeTest, next); }}/><span className="option-key">{String.fromCharCode(65 + choiceIndex)}</span>{option}</label>)}</div></fieldset>)}<button className="primary-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit test and view report →'}</button></form></>}
        </section> : <div className={`grid ${isStaff ? 'two' : ''} records-grid`}>
          {isStaff && <article className="card glass-card test-builder"><p className="eyebrow">ASSESSMENTS / AUTHORING</p><h3>Create a timed test</h3><p className="muted">Build an automatically scored multiple choice assessment and assign it to a class.</p><form className="record-form" onSubmit={createTest}><label>Class<select name="classId" required><option value="">Choose a class</option>{classes.map((room) => <option key={room._id} value={room._id}>{room.name} · {room.subject}</option>)}</select></label><label>Test title<input name="title" required maxLength="140" placeholder="Unit 3 · Algebra assessment"/></label><label>Student instructions<textarea name="instructions" rows="3" maxLength="2000" placeholder="Read each question carefully…"/></label><div className="form-inline"><label>Opens<input name="opensAt" type="datetime-local" required/></label><label>Closes<input name="closesAt" type="datetime-local" required/></label></div><label>Time limit (minutes)<input name="durationMinutes" type="number" min="1" max="300" defaultValue="30" required/></label><div className="test-editor-heading"><strong>Questions</strong><span>{testQuestions.length} added</span></div>{testQuestions.map((question, questionIndex) => <fieldset className="question-editor" key={questionIndex}><legend>QUESTION {String(questionIndex + 1).padStart(2, '0')}</legend><label>Prompt<textarea required maxLength="1000" rows="2" value={question.prompt} onChange={(event) => setTestQuestions((items) => items.map((item, index) => index === questionIndex ? { ...item, prompt: event.target.value } : item))}/></label><div className="editor-options">{question.options.map((option, optionIndex) => <label key={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}<input required maxLength="300" value={option} onChange={(event) => setTestQuestions((items) => items.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((choice, choiceNo) => choiceNo === optionIndex ? event.target.value : choice) } : item))}/></label>)}</div><label>Correct answer<select value={question.correctOption} onChange={(event) => setTestQuestions((items) => items.map((item, index) => index === questionIndex ? { ...item, correctOption: Number(event.target.value) } : item))}>{question.options.map((_, optionIndex) => <option value={optionIndex} key={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}</option>)}</select></label>{testQuestions.length > 1 && <button type="button" className="remove-question" onClick={() => setTestQuestions((items) => items.filter((_, index) => index !== questionIndex))}>Remove question</button>}</fieldset>)}<button type="button" className="secondary-button" onClick={() => setTestQuestions((items) => [...items, { prompt: '', options: ['', '', '', ''], correctOption: 0 }])} disabled={testQuestions.length >= 100}>＋ Add question</button><button className="primary-button" disabled={busy || !classes.length}>Publish test and notify students →</button></form></article>}
          <section className="assignment-list test-list">{tests.length ? tests.map((item) => { const own = !isStaff ? item.attempts[0] : null; const open = Date.now() >= Date.parse(item.opensAt) && Date.now() <= Date.parse(item.closesAt); return <article className="card glass-card assignment-card test-card" key={item._id}><p className="eyebrow">{item.class?.name || 'CLASS'} · {item.class?.subject || 'ASSESSMENT'}</p><h3>{item.title}</h3><p className="muted">{item.instructions || 'No additional instructions.'}</p><div className="test-meta"><span>{item.questions.length} questions</span><span>{item.durationMinutes} minutes</span><span>Closes {dateTimeLabel(item.closesAt)}</span></div>{isStaff ? <div className="submission-list"><strong>{item.attempts.filter((attempt) => attempt.submittedAt).length} / {item.attempts.length} completed</strong>{item.attempts.filter((attempt) => attempt.submittedAt).map((attempt) => <p key={attempt._id}>{attempt.student?.name || 'Student'} · {attempt.score}/{attempt.total} ({attempt.percentage}%)</p>)}</div> : <div className="test-card-action">{own?.submittedAt && <div className="test-result-preview"><span>REPORT CARD</span><strong>{own.score}/{own.total} · {own.percentage}%</strong></div>}<button className="primary-button" disabled={busy || (!open && !own)} onClick={() => void startTest(item)}>{own?.submittedAt ? 'View report card →' : own ? 'Continue test →' : open ? 'Start test →' : Date.now() < Date.parse(item.opensAt) ? 'Opens soon' : 'Test window closed'}</button></div>}</article>; }) : <article className="card glass-card"><p className="empty-state">{isStaff ? 'No tests yet. Create an assessment and assign it to one of your classes.' : 'No tests have been assigned to your classes yet.'}</p></article>}</section>
        </div>) : view === 'students' && isStaff ? <section className="card glass-card directory-card"><div className="section-title"><div><p className="eyebrow">PEOPLE / STUDENTS</p><h3>Student directory</h3></div><span className="badge">{totalStudents} ACTIVE</span></div><div className="directory-tools"><input type="search" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search name or school email" aria-label="Search students"/><button className="secondary-button" onClick={() => { setSelectedStudentEmail(''); navigate('manage'); }}>Add a record</button></div>{filteredStudents.length ? <div className="student-directory">{filteredStudents.map((student) => <article className="student-row" key={student._id}><StudentAvatar student={student} token={session.token}/><div className="student-identity"><strong>{student.name}</strong><span>{student.email}</span></div><small>Joined {dateLabel(student.createdAt)}</small><button className="badge" onClick={() => { setSelectedStudentEmail(student.email); navigate('manage'); }}>Add grade / fee</button><button className="badge remove-student-button" disabled={busy} aria-label={`Remove ${student.name}`} onClick={() => removeStudent(student)}>Remove student</button></article>)}</div> : <p className="empty-state">{students.length ? 'No students match that search.' : 'No student accounts have registered yet.'}</p>}<small className="muted student-retention-note">Deleting a student permanently removes their account, photo, notifications, and class enrollment. Grade, fee, attendance, and submitted assignment history stays in school records.</small></section>
          : view !== 'manage' ? <>
            <div className={`grid ${isStaff ? 'staff-kpis' : ''}`}>
              {isStaff ? <>
                <article className="card glass-card kpi"><p className="eyebrow">ACTIVE STUDENTS</p><h2>{totalStudents}</h2><p>{students.length < totalStudents ? `Showing ${students.length} in directory` : 'Student accounts'}</p></article>
                <article className="card glass-card kpi"><p className="eyebrow">GRADES PUBLISHED</p><h2>{grades.length}</h2><p>Latest academic records</p></article>
                <article className="card glass-card kpi purple"><p className="eyebrow">PENDING FEES</p><h2>{pendingFees.length}</h2><p>Need follow-up</p></article>
                <article className="card glass-card kpi"><p className="eyebrow">UNREAD UPDATES</p><h2>{unread}</h2><p>In-app notices</p></article>
              </> : <>
                <article className="card glass-card kpi"><p className="eyebrow">PUBLISHED GRADES</p><h2>{grades.length}</h2><p>Records available to you</p></article>
                <article className="card glass-card kpi purple"><p className="eyebrow">FEE ITEMS</p><h2>{fees.length}</h2><p>{pendingFees.length} pending</p></article>
                <article className="card glass-card kpi"><p className="eyebrow">UNREAD NOTIFICATIONS</p><h2>{unread}</h2><p>In-app updates</p></article>
              </>}
            </div>
            {isStaff && view === 'overview' && <div className="grid two records-grid"><article className="card glass-card"><p className="eyebrow">TEACHING WORKSPACE</p><h3>Quick actions</h3><p className="muted">Browse students, publish grades, and send fee reminders. Updates appear in the student dashboard immediately.</p><div className="quick-actions"><button className="secondary-button" onClick={() => navigate('students')}>Browse students</button><button className="primary-button action-inline" onClick={() => { setSelectedStudentEmail(''); navigate('manage'); }}>Publish grade or fee <span>→</span></button></div></article><article className="card glass-card"><p className="eyebrow">SYNC / ACCESS</p><h3>{liveConnected ? 'Live updates connected' : 'Reconnecting to live updates'}</h3><p className="muted">Changes from this account and other staff accounts sync automatically. Fallback refresh runs every 30 seconds.</p></article></div>}
            <div className="grid two records-grid">
              {(view === 'overview' || view === 'grades') && <article className="card glass-card"><div className="section-title"><h3>{isStaff ? 'Recent grades' : 'Grades'}</h3><span className="badge">{grades.length} RECORDS</span></div>{grades.length ? <div className="list">{grades.map((record) => <div className="list-row record-row" key={record._id}><div><strong>{record.title}</strong><span>{record.student?.name ? `${record.student.name} · ` : ''}{record.detail || 'Grade published'}</span></div><b>{record.value ?? '—'}{record.maxValue ? ` / ${record.maxValue}` : ''}</b></div>)}</div> : <p className="empty-state">No grades have been published{isStaff ? ' yet.' : ' to this account yet.'}</p>}</article>}
              {(view === 'overview' || view === 'fees') && <article className="card glass-card"><div className="section-title"><h3>Fees</h3><span className="badge purple">{fees.length} ITEMS</span></div>{fees.length ? <div className="list">{fees.map((record) => <div className="list-row record-row" key={record._id}><div><strong>{record.title}</strong><span>{record.student?.name ? `${record.student.name} · ` : ''}Due {dateLabel(record.dueAt, 'UTC')}{record.detail ? ` · ${record.detail}` : ''}</span></div><b className={record.status === 'pending' ? 'pending-text' : ''}>{record.value != null ? record.value.toLocaleString() : ''} {record.status}</b>{session.role === 'admin' && record.status === 'pending' && <button className="badge settle-button" disabled={busy} onClick={() => settleFee(record)}>Mark settled</button>}</div>)}</div> : <p className="empty-state">No fee items are recorded for this account.</p>}</article>}
            </div>
            {!isStaff && view === 'overview' && <div className="account-note">Academic information appears here when your institution publishes it to your account.</div>}
          </> : <div className="grid two manage-grid">
            <article className="card glass-card"><p className="eyebrow">FINANCE / NOTIFICATION</p><h3>Create fee reminder</h3><form className="record-form" onSubmit={(event) => createAcademicRecord(event, 'fee')}>
              <label>Student<select name="studentEmail" required value={selectedStudentEmail} onChange={(event) => setSelectedStudentEmail(event.target.value)}><option value="">Choose a student</option>{students.map((student) => <option value={student.email} key={student._id}>{student.name} — {student.email}</option>)}</select></label><label>Fee title<input name="title" required maxLength="120" placeholder="Term 2 tuition"/></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><label>Due date<input name="dueAt" type="date" required/></label><label>Message<textarea name="message" rows="3" maxLength="1000" placeholder="Payment details and next steps"/></label><button className="primary-button" disabled={busy || !students.length}>Save fee and notify <span>→</span></button>
            </form></article>
            <article className="card glass-card"><p className="eyebrow">ACADEMICS / NOTIFICATION</p><h3>Publish grade</h3><form className="record-form" onSubmit={(event) => createAcademicRecord(event, 'grade')}>
              <label>Student<select name="studentEmail" required value={selectedStudentEmail} onChange={(event) => setSelectedStudentEmail(event.target.value)}><option value="">Choose a student</option>{students.map((student) => <option value={student.email} key={student._id}>{student.name} — {student.email}</option>)}</select></label><label>Assessment<input name="title" required maxLength="120" placeholder="Midterm examination"/></label><div className="form-inline"><label>Score<input name="score" type="number" min="0" step="0.01" required/></label><label>Out of<input name="outOf" type="number" min="0.01" step="0.01" required/></label></div><label>Feedback<input name="feedback" maxLength="500" placeholder="Optional feedback"/></label><button className="primary-button" disabled={busy || !students.length}>Publish grade and notify <span>→</span></button>
            </form></article>
          </div>}
        </main></div>
      {assistantOpen && <aside className="ai-panel glass-card"><button className="close-panel" onClick={() => setAssistantOpen(false)} aria-label="Close assistant">×</button><div className="ai-heading"><div className="ai-orb"><img src="/brand/aether-academy-icon.png" alt=""/></div><div><p className="eyebrow">AETHER AI</p><h2>How can I help?</h2></div></div><div className="chat-messages" aria-live="polite">{messages.map((item, index) => <div key={index} className={`chat-bubble ${item.role === 'user' ? 'user' : 'system'}`}>{item.content}</div>)}</div><div className="suggestions"><button onClick={() => setChatInput('Explain how I can improve my study routine')}>Study planning</button><button onClick={() => setChatInput('Summarize my account records')}>Summarize my records</button></div><form className="ai-input" onSubmit={sendChat}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask anything…" autoComplete="off"/><button aria-label="Send message" disabled={busy}>↑</button></form></aside>}
    </section>}
    {notice && <div className="toast-region"><div className={`toast visible ${noticeKind}`} role="status">{notice}</div></div>}
  </>;
}

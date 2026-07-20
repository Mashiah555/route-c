let profiles = [];
let activeProfileId = null;
let currentExams = [];
let currentBestSchedule = null;

// --- Theme Managment ---
function setTheme(mode) {
    document.documentElement.style.colorScheme = (mode === 'auto') ? 'light dark' : mode;
    localStorage.setItem('themePref', mode);
}

const savedTheme = localStorage.getItem('themePref') || 'auto';
document.getElementById('themeToggle').value = savedTheme;
setTheme(savedTheme);


// --- Local Storage Managment ---
function initStorage() {
    let storedData = null;
    try {
        const stored = localStorage.getItem('examSchedulerData');
        if (stored) storedData = JSON.parse(stored);
    } catch (e) { console.error('שגיאה בטעינת הנתונים:', e); }

    // Initialization of 12 profiles
    if (!storedData || !storedData.profiles || storedData.profiles.length !== 12 || !storedData.profiles.find(p => p.id === 'y1_s0')) {
        profiles = FIXED_PROFILES.map(fp => ({
            id: fp.id,
            name: fp.name,
            type: fp.type,
            exams: [],
            settings: null
        }));
        activeProfileId = 'y1_s0';
    } else {
        profiles = storedData.profiles;
        activeProfileId = storedData.activeProfileId;
    }

    if (!profiles.find(p => p.id === activeProfileId)) activeProfileId = profiles[0].id;

    updateProfileSelectUI();
    loadActiveProfile();
}

function saveToStorage() {
    const activeProfile = profiles.find(p => p.id === activeProfileId);
    if (activeProfile) {
        activeProfile.exams = currentExams;
        activeProfile.settings = {
            strategy: document.getElementById('strategy').value,
            prioritizeCloseC: document.getElementById('prioritizeCloseC').checked,
            allowDoubleSkip: document.getElementById('allowDoubleSkip').checked,
            rule1: document.getElementById('rule1').checked,
            rule2: document.getElementById('rule2').checked,
            rule3: document.getElementById('rule3').checked,
            maxC: parseInt(document.getElementById('maxC').value),
            minC: parseInt(document.getElementById('minC').value)
        };
    }

    try {
        localStorage.setItem('examSchedulerData', JSON.stringify({ profiles, activeProfileId }));
    } catch (e) { console.error('שגיאה בשמירת הנתונים:', e); }
}

function updateProfileSelectUI() {
    const select = document.getElementById('profileSelect');
    if (!select) return;
    select.innerHTML = '';
    profiles.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.innerText = p.name;
        if (p.id === activeProfileId) option.selected = true;
        select.appendChild(option);
    });
}

function loadActiveProfile() {
    const activeProfile = profiles.find(p => p.id === activeProfileId);
    if (activeProfile) {
        currentExams = activeProfile.exams || [];
        if (activeProfile.settings) {
            document.getElementById('strategy').value = activeProfile.settings.strategy || 'spacing';
            document.getElementById('prioritizeCloseC').checked = activeProfile.settings.prioritizeCloseC !== false;
            document.getElementById('allowDoubleSkip').checked = activeProfile.settings.allowDoubleSkip === true;
            document.getElementById('rule1').checked = activeProfile.settings.rule1 !== false;
            document.getElementById('rule2').checked = activeProfile.settings.rule2 !== false;
            document.getElementById('rule3').checked = activeProfile.settings.rule3 !== false;
            document.getElementById('maxC').value = activeProfile.settings.maxC !== undefined ? activeProfile.settings.maxC : 10;
            document.getElementById('maxVal').innerText = document.getElementById('maxC').value;
            document.getElementById('minC').value = activeProfile.settings.minC !== undefined ? activeProfile.settings.minC : 0;
            document.getElementById('minVal').innerText = document.getElementById('minC').value;
        } else {
            // Default Configurations
            document.getElementById('strategy').value = 'spacing';
            document.getElementById('prioritizeCloseC').checked = true;
            document.getElementById('allowDoubleSkip').checked = false;
            document.getElementById('rule1').checked = true;
            document.getElementById('rule2').checked = true;
            document.getElementById('rule3').checked = true;
            document.getElementById('maxC').value = 10;
            document.getElementById('maxVal').innerText = '10';
            document.getElementById('minC').value = 0;
            document.getElementById('minVal').innerText = '0';
        }
    }
    updateCourseListUI();
    runOptimization();
}

function switchProfile(id) { saveToStorage(); activeProfileId = id; loadActiveProfile(); }


// --- Popup Modal Managment ---
const courseModal = document.getElementById('courseModal');

function handleSkipBToggle(cb) {
    const fA = document.getElementById('forceA');
    const fB = document.getElementById('forceB');
    if (cb.checked) {
        fA.checked = false; fB.checked = false;
        fA.disabled = true; fB.disabled = true;
    } else {
        fA.disabled = false; fB.disabled = false;
    }
}

function openCourseModal() {
    document.getElementById('courseForm').reset();
    document.getElementById('editCourseId').value = '';

    document.getElementById('offeredA').checked = true;
    document.getElementById('offeredB').checked = true;
    document.getElementById('offeredElul').checked = false;

    document.getElementById('modalTitle').innerText = 'הוסף קורס חדש';
    document.getElementById('btnSubmitCourse').innerText = 'שמור קורס';
    handleSkipBToggle(document.getElementById('skipB'));
    courseModal.showModal();
}

function closeCourseModal() { courseModal.close(); }


// --- Courses Managment ---
function handleCourseSubmit(e) {
    e.preventDefault();
    const idField = document.getElementById('editCourseId').value;
    const name = document.getElementById('courseName').value;
    const a = document.getElementById('courseDateA').value;
    const b = document.getElementById('courseDateB').value;
    const forceA = document.getElementById('forceA').checked;
    const forceB = document.getElementById('forceB').checked;
    const skipB = document.getElementById('skipB').checked;

    const offeredA = document.getElementById('offeredA').checked;
    const offeredB = document.getElementById('offeredB').checked;
    const offeredElul = document.getElementById('offeredElul').checked;

    if (idField) {
        const index = currentExams.findIndex(ex => ex.id === idField);
        if (index > -1) currentExams[index] = { id: idField, name, a, b, forceA, forceB, skipB, offeredA, offeredB, offeredElul };
    } else {
        const newId = 'C_' + Date.now();
        const existingIndex = currentExams.findIndex(ex => ex.name === name);
        if (existingIndex > -1) {
            currentExams[existingIndex] = { id: currentExams[existingIndex].id, name, a, b, forceA, forceB, skipB, offeredA, offeredB, offeredElul };
        } else {
            currentExams.push({ id: newId, name, a, b, forceA, forceB, skipB, offeredA, offeredB, offeredElul });
        }
    }

    closeCourseModal();
    updateCourseListUI();
    runOptimization();
}

function editCourse(id) {
    const course = currentExams.find(ex => ex.id === id);
    if (!course) return;

    document.getElementById('editCourseId').value = course.id;
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseDateA').value = course.a;
    document.getElementById('courseDateB').value = course.b;
    document.getElementById('forceA').checked = course.forceA || false;
    document.getElementById('forceB').checked = course.forceB || false;
    document.getElementById('skipB').checked = course.skipB || false;

    document.getElementById('offeredA').checked = course.offeredA !== false;
    document.getElementById('offeredB').checked = course.offeredB !== false;
    document.getElementById('offeredElul').checked = course.offeredElul || false;

    handleSkipBToggle(document.getElementById('skipB'));

    document.getElementById('modalTitle').innerText = 'ערוך קורס';
    document.getElementById('btnSubmitCourse').innerText = 'עדכן קורס';
    courseModal.showModal();
}

function deleteCourse(id) {
    currentExams = currentExams.filter(ex => ex.id !== id);
    updateCourseListUI();
    runOptimization();
}

function loadDefaults() {
    DEFAULT_EXAMS.forEach(defExam => {
        const existingIndex = currentExams.findIndex(ex => ex.name === defExam.name);
        if (existingIndex > -1) {
            currentExams[existingIndex] = { ...defExam, id: currentExams[existingIndex].id };
        } else {
            currentExams.push({ ...defExam, id: 'C_' + Math.random().toString(36).substr(2, 9) });
        }
    });
    updateCourseListUI();
    runOptimization();
}

function updateCourseListUI() {
    const container = document.getElementById('courseList');
    container.innerHTML = '';
    currentExams.forEach(course => {
        const div = document.createElement('div');
        div.className = 'course-item';

        let tags = '';
        if (course.skipB) tags = `<span class="dates" style="color:var(--success)">עבר במועד א'</span>`;
        else if (course.forceA || course.forceB) tags = `<span class="dates" style="color:var(--accent-rose)">אילוץ: ${course.forceA ? "א' " : ""}${course.forceB ? "ב'" : ""}</span>`;

        let availability = [];
        if (course.offeredA) availability.push("א'");
        if (course.offeredB) availability.push("ב'");
        if (course.offeredElul) availability.push("אלול");
        let availStr = availability.length > 0 ? `זמין בסמסטר ${availability.join("+")}` : "לא זמין!";

        div.innerHTML = `
            <div class="course-info">
                <strong>${course.name}</strong>
                <span class="dates">א': ${formatDate(course.a)} | ב': ${formatDate(course.b)}</span>
                <span class="dates" style="color: var(--text-muted)">${availStr}</span>
                ${tags}
            </div>
            <div class="course-actions">
                <button onclick="editCourse('${course.id}')" title="ערוך">✏️</button>
                <button onclick="deleteCourse('${course.id}')" title="מחק">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });
}


// --- Algorithm Integration ---
function runOptimization() {
    saveToStorage();

    if (currentExams.length === 0) {
        document.getElementById('resultsBody').innerHTML = '<tr><td colspan="4" style="text-align:center;">הוסף קורסים כדי לראות תוצאות</td></tr>';
        document.getElementById('calendarContainer').innerHTML = '';
        currentBestSchedule = null;
        return;
    }

    const activeProfile = profiles.find(p => p.id === activeProfileId);
    const semType = activeProfile ? activeProfile.type : 0;

    const settings = {
        currentSemester: semType,
        strategy: document.getElementById('strategy').value,
        prioritizeCloseC: document.getElementById('prioritizeCloseC').checked,
        allowDoubleSkip: document.getElementById('allowDoubleSkip').checked,
        rule1: document.getElementById('rule1').checked,
        rule2: document.getElementById('rule2').checked,
        rule3: document.getElementById('rule3').checked,
        maxC: parseInt(document.getElementById('maxC').value),
        minC: parseInt(document.getElementById('minC').value)
    };

    const result = calculateEngine(currentExams, settings);
    currentBestSchedule = result;
    renderScheduleTable(result);
    renderDynamicCalendar(result);
}

function getAttendText(justifies, isOpt3, examDateStr) {
    if (justifies && justifies.length > 0) {
        // The attendance is required for the justification of another course
        let html = '';
        if (isOpt3) {
            html += `<span class="badge-attend" style="color: var(--success)">ציון עובר</span>`;
        } else {
            html += `<span class="badge-attend" style="color: var(--accent-rose)">חייב לגשת</span>`;
        }
        html += `<span class="reasoning" style="color: var(--text-muted)">מצדיק מועד ג' ל${justifies.join(', ')}</span>`;
        return html;
    } else {
        // The attendance is not required by the constrains of other courses (יכול לגשת / ניגש / עובר)

        if (isOpt3) {
            return `<span class="badge-attend" style="color: var(--success)">ציון עובר</span>`;
        }

        let today = new Date();
        today.setHours(0, 0, 0, 0);
        let examDate = new Date(examDateStr);
        examDate.setHours(0, 0, 0, 0);

        if (examDate < today) {
            return `<span class="badge-attend" style="color: var(--primary-blue)">ניגש</span>`;
        } else {
            return `<span class="badge-attend" style="color: var(--primary-blue)">יכול לגשת</span>`;
        }
    }
}

function formatDate(date) {
    return date.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
}

function renderScheduleTable(schedule) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    if (!schedule) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">לא נמצא סידור חוקי העונה על ההגדרות והאילוצים</td></tr>';
        return;
    }

    schedule.forEach(item => {
        const tr = document.createElement('tr');

        let textA, textB, textC;

        if (item.opt === 4) {
            textA = `<span class="badge-absence">היעדרות מוצדקת</span><span class="reasoning">${item.reasonA}</span>`;
            textB = `<span class="badge-absence">היעדרות מוצדקת</span><span class="reasoning">${item.reasonB}</span>`;
            textC = `<span class="icon-check">✅</span><span class="reasoning" style="color: var(--primary-blue)">ב${item.nextMoedC}</span>`;
        } else {
            // Moed A
            if (item.opt === 0 || item.opt === 1 || item.opt === 3) {
                textA = getAttendText(item.justifiesA, item.opt === 3, item.course.a);
            } else {
                textA = `<span class="badge-absence">היעדרות מוצדקת</span><span class="reasoning">${item.reasonA}</span>`;
            }

            // Moed B
            if (item.opt === 3) {
                textB = `<span style="color: var(--text-muted)">לא נדרש</span>`;
            } else if (item.opt === 0 || item.opt === 2) {
                textB = getAttendText(item.justifiesB, false, item.course.b);
            } else {
                textB = `<span class="badge-absence">היעדרות מוצדקת</span><span class="reasoning">${item.reasonB}</span>`;
            }

            // Moed C
            if (item.opt === 1 || item.opt === 2) {
                textC = `<span class="icon-check">✅</span><span class="reasoning" style="color: var(--primary-blue)">ב${item.nextMoedC}</span>`;
            } else {
                textC = `<span class="icon-cross">❌</span>`;
            }
        }

        tr.innerHTML = `
            <td style="font-weight: 500;">${item.course.name}</td>
            <td>${textA}</td>
            <td>${textB}</td>
            <td style="text-align: center;">${textC}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Dynamic Calendar ---
function renderDynamicCalendar(schedule) {
    const container = document.getElementById('calendarContainer');
    container.innerHTML = '';
    if (!schedule) return;

    let minDate = new Date("9999-12-31");
    let maxDate = new Date("1970-01-01");
    const events = {};

    schedule.forEach(item => {
        let dA = new Date(item.course.a);
        if (dA < minDate) minDate = dA;
        if (dA > maxDate) maxDate = dA;
        let dateStrA = dA.toISOString().split('T')[0];
        if (!events[dateStrA]) events[dateStrA] = [];

        let isAttendedA = (item.opt === 0 || item.opt === 1 || item.opt === 3);
        events[dateStrA].push({ name: item.course.name, type: 'moed-a', label: "מועד א'", attended: isAttendedA });

        let dB = new Date(item.course.b);
        if (dB < minDate) minDate = dB;
        if (dB > maxDate) maxDate = dB;
        let dateStrB = dB.toISOString().split('T')[0];
        if (!events[dateStrB]) events[dateStrB] = [];

        let isAttendedB = (item.opt === 0 || item.opt === 2);
        let labelB = (item.opt === 3) ? "מועד ב' (לא נדרש)" : "מועד ב'";
        events[dateStrB].push({ name: item.course.name, type: 'moed-b', label: labelB, attended: isAttendedB });
    });

    if (minDate > maxDate) return;

    let startYear = minDate.getFullYear();
    let startMonth = minDate.getMonth();
    let endYear = maxDate.getFullYear();
    let endMonth = maxDate.getMonth();

    const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

    let currY = startYear;
    let currM = startMonth;

    while (currY < endYear || (currY === endYear && currM <= endMonth)) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'month-container';

        const title = document.createElement('div');
        title.className = 'month-title';
        title.innerText = `${monthNames[currM]} ${currY}`;
        monthDiv.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        dayNames.forEach(day => {
            const dHeader = document.createElement('div');
            dHeader.className = 'day-header';
            dHeader.innerText = day;
            grid.appendChild(dHeader);
        });

        const firstDay = new Date(currY, currM, 1).getDay();
        const daysInMonth = new Date(currY, currM + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'day-cell empty';
            grid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';

            const dateObj = new Date(currY, currM, day, 12, 0, 0);
            const dateStr = dateObj.toISOString().split('T')[0];

            const dayNum = document.createElement('div');
            dayNum.className = 'day-number';
            dayNum.innerText = day;
            cell.appendChild(dayNum);

            if (events[dateStr]) {
                let hasAttended = false;
                events[dateStr].forEach(ev => {
                    const evDiv = document.createElement('div');
                    let skippedClass = ev.attended ? '' : 'skipped';
                    evDiv.className = `exam-event ${ev.type} ${skippedClass}`;
                    evDiv.innerText = `${ev.name} (${ev.label})`;
                    cell.appendChild(evDiv);
                    if (ev.attended) hasAttended = true;
                });
                if (hasAttended) cell.style.borderColor = 'rgba(65, 105, 225, 0.4)';
            }
            grid.appendChild(cell);
        }

        monthDiv.appendChild(grid);
        container.appendChild(monthDiv);

        currM++;
        if (currM > 11) { currM = 0; currY++; }
    }
}

// --- Calendar Export ---
function exportICS() {
    if (!currentBestSchedule) return;
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Optimal Exam Scheduler//IL\n";

    currentBestSchedule.forEach(item => {
        let dateA = new Date(item.course.a);
        let dateB = new Date(item.course.b);

        if (item.opt === 0 || item.opt === 1 || item.opt === 3) ics += generateICSEvent(item.course.name + " - מועד א'", dateA);
        if (item.opt === 0 || item.opt === 2) ics += generateICSEvent(item.course.name + " - מועד ב'", dateB);
    });

    ics += "END:VCALENDAR";
    let blob = new Blob([ics], { type: 'text/calendar' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = "exams_optimal_schedule.ics";
    a.click();
}

function generateICSEvent(title, dateObj) {
    let y = dateObj.getFullYear();
    let m = String(dateObj.getMonth() + 1).padStart(2, '0');
    let d = String(dateObj.getDate()).padStart(2, '0');
    let dateStr = `${y}${m}${d}`;
    return `BEGIN:VEVENT\nSUMMARY:${title}\nDTSTART;VALUE=DATE:${dateStr}\nDTEND;VALUE=DATE:${dateStr}\nEND:VEVENT\n`;
}

// --- Side Panel Managment ---
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-closed', sidebar.classList.contains('collapsed'));
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}

if (localStorage.getItem('sidebarCollapsed') === 'true') {
    document.querySelector('.sidebar').classList.add('collapsed');
    document.body.classList.add('sidebar-closed');
}

// Startup Call
initStorage();
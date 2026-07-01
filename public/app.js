let currentExams = [];
let currentBestSchedule = null;

// --- Theme Handling ---
function setTheme(mode) {
    document.documentElement.style.colorScheme = (mode === 'auto') ? 'light dark' : mode;
    localStorage.setItem('themePref', mode);
}

// Theme initiation at startup
const savedTheme = localStorage.getItem('themePref') || 'auto';
document.getElementById('themeToggle').value = savedTheme;
setTheme(savedTheme);


// --- Modal Handling ---
const courseModal = document.getElementById('courseModal');

function openCourseModal() {
    document.getElementById('courseForm').reset();
    document.getElementById('editCourseId').value = '';
    document.getElementById('modalTitle').innerText = 'הוסף קורס חדש';
    document.getElementById('btnSubmitCourse').innerText = 'שמור קורס';
    courseModal.showModal();
}

function closeCourseModal() {
    courseModal.close();
}

// --- Courses Handling (CRUD) ---
function handleCourseSubmit(e) {
    e.preventDefault();
    const idField = document.getElementById('editCourseId').value;
    const name = document.getElementById('courseName').value;
    const a = document.getElementById('courseDateA').value;
    const b = document.getElementById('courseDateB').value;
    const forceA = document.getElementById('forceA').checked;
    const forceB = document.getElementById('forceB').checked;

    if (idField) {
        const index = currentExams.findIndex(ex => ex.id === idField);
        if (index > -1) currentExams[index] = { id: idField, name, a, b, forceA, forceB };
    } else {
        const newId = 'C_' + Date.now();
        const existingIndex = currentExams.findIndex(ex => ex.name === name);
        if (existingIndex > -1) {
            currentExams[existingIndex] = { id: currentExams[existingIndex].id, name, a, b, forceA, forceB };
        } else {
            currentExams.push({ id: newId, name, a, b, forceA, forceB });
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
    document.getElementById('forceA').checked = course.forceA;
    document.getElementById('forceB').checked = course.forceB;

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
        div.innerHTML = `
            <div class="course-info">
                <strong>${course.name}</strong>
                <span class="dates">א': ${course.a} | ב': ${course.b}</span>
                ${course.forceA || course.forceB ? `<span class="dates" style="color:var(--accent-rose)">אילוץ: ${course.forceA ? "מועד א " : ""}${course.forceB ? "מועד ב" : ""}</span>` : ''}
            </div>
            <div class="course-actions">
                <button onclick="editCourse('${course.id}')" title="ערוך">✏️</button>
                <button onclick="deleteCourse('${course.id}')" title="מחק">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- Integration with the optimization Engine ---
function runOptimization() {
    if (currentExams.length === 0) {
        document.getElementById('resultsBody').innerHTML = '<tr><td colspan="4" style="text-align:center;">הוסף קורסים כדי לראות תוצאות</td></tr>';
        document.getElementById('calendarContainer').innerHTML = '';
        currentBestSchedule = null;
        return;
    }

    const settings = {
        strategy: document.getElementById('strategy').value,
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

function renderScheduleTable(schedule) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    if (!schedule) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">לא נמצא סידור חוקי העונה על ההגדרות והאילוצים</td></tr>';
        return;
    }

    schedule.forEach(item => {
        const tr = document.createElement('tr');

        let textA = `<span class="badge-attend">חייב לגשת</span>`;
        if (item.opt === 2) textA = `<span class="badge-absence">היעדרות מוצדקת</span><span class="reasoning">${item.reasonA}</span>`;

        let textB = `<span class="badge-attend">חייב לגשת</span>`;
        if (item.opt === 1) textB = `<span class="badge-absence">היעדרות מוצדקת</span><span class="reasoning">${item.reasonB}</span>`;

        let textC = (item.opt === 1 || item.opt === 2) ? `<span class="icon-check">✅</span>` : `<span class="icon-cross">❌</span>`;

        tr.innerHTML = `
            <td style="font-weight: 500;">${item.course.name}</td>
            <td>${textA}</td>
            <td>${textB}</td>
            <td style="text-align: center;">${textC}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Dynamic Calendar (includes skipped exams)
function renderDynamicCalendar(schedule) {
    const container = document.getElementById('calendarContainer');
    container.innerHTML = '';
    if (!schedule) return;

    let minDate = new Date("9999-12-31");
    let maxDate = new Date("1970-01-01");
    const events = {};

    schedule.forEach(item => {
        // Moed A - Includes all
        let dA = new Date(item.course.a);
        if (dA < minDate) minDate = dA;
        if (dA > maxDate) maxDate = dA;
        let dateStrA = dA.toISOString().split('T')[0];
        if (!events[dateStrA]) events[dateStrA] = [];

        let isAttendedA = (item.opt === 0 || item.opt === 1);
        events[dateStrA].push({
            name: item.course.name,
            type: 'moed-a',
            label: "מועד א'",
            attended: isAttendedA
        });

        // Moed B - Includes all
        let dB = new Date(item.course.b);
        if (dB < minDate) minDate = dB;
        if (dB > maxDate) maxDate = dB;
        let dateStrB = dB.toISOString().split('T')[0];
        if (!events[dateStrB]) events[dateStrB] = [];

        let isAttendedB = (item.opt === 0 || item.opt === 2);
        events[dateStrB].push({
            name: item.course.name,
            type: 'moed-b',
            label: "מועד ב'",
            attended: isAttendedB
        });
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
                    // Add 'skipped' class for exams defined as skipped
                    let skippedClass = ev.attended ? '' : 'skipped';
                    evDiv.className = `exam-event ${ev.type} ${skippedClass}`;
                    evDiv.innerText = `${ev.name} (${ev.label})`;
                    cell.appendChild(evDiv);

                    if (ev.attended) hasAttended = true;
                });

                if (hasAttended) {
                    cell.style.borderColor = 'rgba(65, 105, 225, 0.4)';
                }
            }
            grid.appendChild(cell);
        }

        monthDiv.appendChild(grid);
        container.appendChild(monthDiv);

        currM++;
        if (currM > 11) {
            currM = 0;
            currY++;
        }
    }
}

// --- Calendar Export ---
function exportICS() {
    if (!currentBestSchedule) return;
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Optimal Exam Scheduler//IL\n";

    currentBestSchedule.forEach(item => {
        let dateA = new Date(item.course.a);
        let dateB = new Date(item.course.b);

        // מייצאים רק את המבחנים שניגשים אליהם בפועל
        if (item.opt === 0 || item.opt === 1) ics += generateICSEvent(item.course.name + " - מועד א'", dateA);
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
function getWorkingDaysDiff(t1, t2) {
    let d1 = new Date(Math.min(t1, t2));
    let d2 = new Date(Math.max(t1, t2));
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    let diff = 0;
    let current = new Date(d1);
    while (current < d2) {
        current.setDate(current.getDate() + 1);
        if (current.getDay() !== 6) diff++;
    }
    return diff;
}

function getAttendedPenalty(dates) {
    let penalty = 0;
    let sorted = [...dates].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
        let diff = getWorkingDaysDiff(sorted[i], sorted[i + 1]);
        if (diff === 0) penalty += 10000000;
        else if (diff === 1) penalty += 10000;
        else if (diff === 2) penalty += 500;
        else if (diff === 3) penalty += 50;
    }
    return penalty;
}

function isValidAbsence(targetDate, attendedDates, r1, r2, r3) {
    if (r1) {
        for (let d of attendedDates) {
            if (getWorkingDaysDiff(targetDate, d) === 0) return { valid: true, reason: 'התנגשות עם בחינה אחרת' };
        }
    }
    if (r2 && attendedDates.length >= 2) {
        for (let i = 0; i < attendedDates.length; i++) {
            for (let j = i + 1; j < attendedDates.length; j++) {
                let dates = [targetDate, attendedDates[i], attendedDates[j]].sort((a, b) => a - b);
                if (getWorkingDaysDiff(dates[0], dates[2]) <= 2) return { valid: true, reason: '3 בחינות ברצף' };
            }
        }
    }
    if (r3 && attendedDates.length >= 3) {
        for (let i = 0; i < attendedDates.length; i++) {
            for (let j = i + 1; j < attendedDates.length; j++) {
                for (let k = j + 1; k < attendedDates.length; k++) {
                    let dates = [targetDate, attendedDates[i], attendedDates[j], attendedDates[k]].sort((a, b) => a - b);
                    if (getWorkingDaysDiff(dates[0], dates[3]) <= 6) return { valid: true, reason: '4 בחינות בשבוע' };
                }
            }
        }
    }
    return { valid: false };
}

// Cartesic Product Generator for dynamic combinations
function cartesianProduct(arr) {
    return arr.reduce((a, b) => a.flatMap(d => b.map(e => [...d, e])), [[]]);
}

function calculateEngine(exams, settings) {
    if (exams.length === 0) return null;

    let bestSchedule = null;
    let bestScore = -Infinity;

    // Map all valid options for each course (including manual forces)
    const coursesOptions = exams.map(exam => {
        let opts = [];
        // 0 = A+B, 1 = A+C (Miss B), 2 = Miss A (B+C)
        if (exam.forceA && exam.forceB) opts.push(0);
        else if (exam.forceA) opts.push(0, 1);
        else if (exam.forceB) opts.push(0, 2);
        else opts.push(0, 1, 2);
        return opts;
    });

    const combinations = cartesianProduct(coursesOptions);

    for (let combo of combinations) {
        let cCount = 0;
        let attendedA = [];
        let attendedB = [];
        let missedA = [];
        let missedB = [];
        let schedule = [];

        for (let j = 0; j < exams.length; j++) {
            const opt = combo[j];
            const timeA = new Date(exams[j].a).getTime();
            const timeB = new Date(exams[j].b).getTime();

            if (opt === 0) {
                attendedA.push(timeA);
                attendedB.push(timeB);
            } else if (opt === 1) {
                attendedA.push(timeA);
                missedB.push({ date: timeB, id: exams[j].id });
                cCount++;
            } else {
                missedA.push({ date: timeA, id: exams[j].id });
                attendedB.push(timeB);
                cCount++;
            }
            schedule.push({ course: exams[j], opt, reasonA: null, reasonB: null });
        }

        if (cCount > settings.maxC || cCount < settings.minC) continue;

        let isValid = true;
        for (let miss of missedA) {
            let check = isValidAbsence(miss.date, attendedA, settings.rule1, settings.rule2, settings.rule3);
            if (!check.valid) { isValid = false; break; }
            schedule.find(s => s.course.id === miss.id).reasonA = check.reason;
        }

        if (isValid) {
            for (let miss of missedB) {
                let check = isValidAbsence(miss.date, attendedB, settings.rule1, settings.rule2, settings.rule3);
                if (!check.valid) { isValid = false; break; }
                schedule.find(s => s.course.id === miss.id).reasonB = check.reason;
            }
        }

        if (isValid) {
            let penalty = getAttendedPenalty(attendedA) + getAttendedPenalty(attendedB);
            let score = 0;

            if (settings.strategy === 'spacing') {
                score = -penalty - cCount;
            } else {
                score = (cCount * 500000) - penalty;
            }

            if (score > bestScore) {
                bestScore = score;
                bestSchedule = schedule;
            }
        }
    }
    return bestSchedule;
}
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
            if (getWorkingDaysDiff(targetDate, d) === 0) return { valid: true, reason: 'בחינה נוספת מתקיימת באותו היום.' };
        }
    }
    if (r2 && attendedDates.length >= 2) {
        for (let i = 0; i < attendedDates.length; i++) {
            for (let j = i + 1; j < attendedDates.length; j++) {
                let dates = [targetDate, attendedDates[i], attendedDates[j]].sort((a, b) => a - b);
                if (getWorkingDaysDiff(dates[0], dates[2]) <= 2) return { valid: true, reason: 'עומס של 3 בחינות ב-3 ימי עבודה רצופים.' };
            }
        }
    }
    if (r3 && attendedDates.length >= 3) {
        for (let i = 0; i < attendedDates.length; i++) {
            for (let j = i + 1; j < attendedDates.length; j++) {
                for (let k = j + 1; k < attendedDates.length; k++) {
                    let dates = [targetDate, attendedDates[i], attendedDates[j], attendedDates[k]].sort((a, b) => a - b);
                    if (getWorkingDaysDiff(dates[0], dates[3]) <= 6) return { valid: true, reason: 'עומס של 4 בחינות ב-7 ימי עבודה.' };
                }
            }
        }
    }
    return { valid: false };
}

function getDistancePenalty(course, currentSemester) {
    const avail = [course.offeredA, course.offeredB, course.offeredElul];
    if (!avail[0] && !avail[1] && !avail[2]) return 200;

    for (let i = 1; i <= 3; i++) {
        let nextSem = (currentSemester + i) % 3;
        if (avail[nextSem]) {
            if (i === 1) return 0;
            if (i === 2) return 30;
            if (i === 3) return 100;
        }
    }
    return 200;
}

function getNextSemesterName(course, currentSemester) {
    const avail = [course.offeredA, course.offeredB, course.offeredElul];
    const names = ["סמסטר א'", "סמסטר ב'", "סמסטר אלול"];
    if (!avail[0] && !avail[1] && !avail[2]) return "לא ידוע";

    for (let i = 1; i <= 3; i++) {
        let nextSem = (currentSemester + i) % 3;
        if (avail[nextSem]) return names[nextSem];
    }
    return "";
}

function cartesianProduct(arr) {
    return arr.reduce((a, b) => a.flatMap(d => b.map(e => [...d, e])), [[]]);
}

function calculateEngine(exams, settings) {
    if (exams.length === 0) return null;

    let bestSchedule = null;
    let bestScore = -Infinity;
    const currSem = parseInt(settings.currentSemester) || 0;

    const coursesOptions = exams.map(exam => {
        let opts = [];
        if (exam.skipB) opts.push(3);
        else if (exam.forceA && exam.forceB) opts.push(0);
        else if (exam.forceA) opts.push(0, 1);
        else if (exam.forceB) opts.push(0, 2);
        else {
            opts.push(0, 1, 2);
            // אם אפשרנו דילוג כפול, נוסיף את אופציה 4
            if (settings.allowDoubleSkip) opts.push(4);
        }
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
            } else if (opt === 2) {
                missedA.push({ date: timeA, id: exams[j].id });
                attendedB.push(timeB);
                cCount++;
            } else if (opt === 3) {
                attendedA.push(timeA);
            } else if (opt === 4) {
                // דילוג כפול - שני המועדים דורשים הצדקה מול המבחנים הנותרים בסמסטר
                missedA.push({ date: timeA, id: exams[j].id });
                missedB.push({ date: timeB, id: exams[j].id });
                cCount++;
            }

            let nextMoedC = (opt === 1 || opt === 2 || opt === 4) ? getNextSemesterName(exams[j], currSem) : null;
            schedule.push({ course: exams[j], opt, reasonA: null, reasonB: null, nextMoedC });
        }

        if (cCount > settings.maxC || cCount < settings.minC) continue;

        let isValid = true;
        // אימות כל ההיעדרויות ממועד א' (כולל את אופציות 2 ו-4)
        for (let miss of missedA) {
            let check = isValidAbsence(miss.date, attendedA, settings.rule1, settings.rule2, settings.rule3);
            if (!check.valid) { isValid = false; break; }
            schedule.find(s => s.course.id === miss.id).reasonA = check.reason;
        }

        if (isValid) {
            // אימות כל ההיעדרויות ממועד ב' (כולל את אופציות 1 ו-4)
            for (let miss of missedB) {
                let check = isValidAbsence(miss.date, attendedB, settings.rule1, settings.rule2, settings.rule3);
                if (!check.valid) { isValid = false; break; }
                schedule.find(s => s.course.id === miss.id).reasonB = check.reason;
            }
        }

        if (isValid) {
            let penalty = getAttendedPenalty(attendedA) + getAttendedPenalty(attendedB);

            if (settings.prioritizeCloseC) {
                for (let item of schedule) {
                    if (item.opt === 1 || item.opt === 2 || item.opt === 4) {
                        penalty += getDistancePenalty(item.course, currSem);
                    }
                }
            }

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
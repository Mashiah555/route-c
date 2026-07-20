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

function getAttendedPenalty(attendedObjs) {
    let penalty = 0;
    let sorted = [...attendedObjs].sort((a, b) => a.date - b.date);
    for (let i = 0; i < sorted.length - 1; i++) {
        let diff = getWorkingDaysDiff(sorted[i].date, sorted[i + 1].date);
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
            if (getWorkingDaysDiff(targetDate, d.date) === 0) {
                return { valid: true, reason: 'בחינה נוספת מתקיימת באותו היום', justifiers: [d] };
            }
        }
    }
    if (r2 && attendedDates.length >= 2) {
        for (let i = 0; i < attendedDates.length; i++) {
            for (let j = i + 1; j < attendedDates.length; j++) {
                let dates = [{ date: targetDate }, attendedDates[i], attendedDates[j]].sort((a, b) => a.date - b.date);
                if (getWorkingDaysDiff(dates[0].date, dates[2].date) <= 2) {
                    return { valid: true, reason: 'עומס של 3 בחינות ב-3 ימי עבודה רצופים', justifiers: [attendedDates[i], attendedDates[j]] };
                }
            }
        }
    }
    if (r3 && attendedDates.length >= 3) {
        for (let i = 0; i < attendedDates.length; i++) {
            for (let j = i + 1; j < attendedDates.length; j++) {
                for (let k = j + 1; k < attendedDates.length; k++) {
                    let dates = [{ date: targetDate }, attendedDates[i], attendedDates[j], attendedDates[k]].sort((a, b) => a.date - b.date);
                    if (getWorkingDaysDiff(dates[0].date, dates[3].date) <= 6) {
                        return { valid: true, reason: 'עומס של 4 בחינות ב-7 ימי עבודה', justifiers: [attendedDates[i], attendedDates[j], attendedDates[k]] };
                    }
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

            let objA = { date: timeA, id: exams[j].id, name: exams[j].name };
            let objB = { date: timeB, id: exams[j].id, name: exams[j].name };

            if (opt === 0) {
                attendedA.push(objA);
                attendedB.push(objB);
            } else if (opt === 1) {
                attendedA.push(objA);
                missedB.push(objB);
                cCount++;
            } else if (opt === 2) {
                missedA.push(objA);
                attendedB.push(objB);
                cCount++;
            } else if (opt === 3) {
                attendedA.push(objA);
            } else if (opt === 4) {
                missedA.push(objA);
                missedB.push(objB);
                cCount++;
            }

            let nextMoedC = (opt === 1 || opt === 2 || opt === 4) ? getNextSemesterName(exams[j], currSem) : null;
            schedule.push({ course: exams[j], opt, reasonA: null, reasonB: null, nextMoedC, justifiesA: [], justifiesB: [] });
        }

        if (cCount > settings.maxC || cCount < settings.minC) continue;

        let isValid = true;

        // Validate all moed A absences 
        for (let miss of missedA) {
            let check = isValidAbsence(miss.date, attendedA, settings.rule1, settings.rule2, settings.rule3);
            if (!check.valid) {
                isValid = false; break;
            }
            schedule.find(s => s.course.id === miss.id).reasonA = check.reason;

            // Documents the courses that are required for the justification
            if (check.justifiers) {
                check.justifiers.forEach(justifier => {
                    let sItem = schedule.find(s => s.course.id === justifier.id);
                    if (sItem && !sItem.justifiesA.includes(miss.name)) sItem.justifiesA.push(miss.name);
                });
            }
        }

        if (isValid) {
            // Validate all moed B absences
            for (let miss of missedB) {
                let check = isValidAbsence(miss.date, attendedB, settings.rule1, settings.rule2, settings.rule3);
                if (!check.valid) {
                    isValid = false; break;
                }
                schedule.find(s => s.course.id === miss.id).reasonB = check.reason;

                // Documents the courses that are required for the justification
                if (check.justifiers) {
                    check.justifiers.forEach(justifier => {
                        let sItem = schedule.find(s => s.course.id === justifier.id);
                        if (sItem && !sItem.justifiesB.includes(miss.name)) sItem.justifiesB.push(miss.name);
                    });
                }
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
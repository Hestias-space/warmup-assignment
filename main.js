const fs = require("fs");

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================

// helper function converts time in hh:mm:ss am or pm format to total seconds
function toSeconds(time) {
    //      6:12:30    pm
    let [clock, period] = time.split(" "); // am w pm are seperated by space
    //     [ "6", "12", "30"]   
    let parts = clock.split(":");

    //parts is an array of strings 
    let h = parseInt(parts[0]);
    let m = parseInt(parts[1]);
    let s = parseInt(parts[2]);

    //24 hour conversion!!!
    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;

    return h * 3600 + m * 60 + s;
}
//another helper but for formats like hh:mm:ss without am or pm
function toSecondsNoPeriod(time) {
    let parts = time.split(":");

    let h = parseInt(parts[0]);
    let m = parseInt(parts[1]);
    let s = parseInt(parts[2]);
    return h * 3600 + m * 60 + s;
}
//helper function to reconvert seconds to h:mm:ss format + adding zeros to the left 
function formatTime(totalSeconds) {
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;
    return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}


function getShiftDuration(startTime, endTime) {
    let start = toSeconds(startTime);
    let end = toSeconds(endTime);
    // 7:30:30 am  -> 07:30:30
    // 12:26:20 am -> 00:26:20
    //if the shift goes past midnight, we need to add 24 hours *3600 to the end time
    if (end < start) end += 86400;

    let diff = end - start;

    return formatTime(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================

//
function getIdleTime(startTime, endTime) {

    const deliveryStart = 8 * 3600;   // 8am in seconds
    const deliveryEnd = 22 * 3600;  // 10pm in seconds

    let shiftStart = toSeconds(startTime);
    let shiftEnd = toSeconds(endTime);

    // before 8 am
    let before = 0;
    //handle edge case if the shift actually starts after 8 am
    if (shiftStart < deliveryStart) {
        //edge case driver clocks out before deliveries even start so we need to calculate idle time from shift start to shift end
        before = Math.min(deliveryStart, shiftEnd) - shiftStart;
    }

    // after 10 pm
    let after = 0;
    //handle edge case if the shift ends before 10 pm
    if (shiftEnd > deliveryEnd) {
        // edge case driver clocks in after deliveries end so we need to calculate idle time from shift start to shift end
        after = shiftEnd - Math.max(deliveryEnd, shiftStart);
    }

    return formatTime(before + after);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {

    if (idleTime === "0:00:00") return shiftDuration; // edge case if there is no idle time
    activeTime = toSecondsNoPeriod(shiftDuration) - toSecondsNoPeriod(idleTime);

    return formatTime(activeTime);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {

    const dailyQuota = 8 * 3600 + 24 * 60; // 8 hours and 24 minutes in seconds
    const eidQuota = 6 * 3600; // 6 hours in seconds

    let [year, month, day] = date.split("-");

    if (month === "04" && (day >= "10" && day <= "30")) {
        return toSecondsNoPeriod(activeTime) >= eidQuota;
    }
    return toSecondsNoPeriod(activeTime) >= dailyQuota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    //                                     read bytes to normal text
    let content = fs.readFileSync(textFile, "utf-8");
    let rows = content.split("\n"); // split text into rows

    //CHECK FOR DUPLICATE with id w dateeee
    for (let row of rows) {
        let cols = row.split(",");
        if (cols[0] === shiftObj.driverID && cols[2] === shiftObj.date) {
            return {};
        }
    }
    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let quota = metQuota(shiftObj.date, activeTime);
    // da esmo template literal 3shan ne7ot kol el values fe string wa7da using back tick `` 
    let newRow = `${shiftObj.driverID},${shiftObj.driverName},${shiftObj.date},${shiftObj.startTime},${shiftObj.endTime},${shiftDuration},${idleTime},${activeTime},${quota},false`;


    let lastIndex = -1;
    for (let i = 0; i < rows.length; i++) {
        //if same driver ID is found, update lastIndex to current index 

        if (rows[i].split(",")[0] === shiftObj.driverID) {
            lastIndex = i;
        }
    }

    // if lastIndex is -1, it means driverID was not found in the file 
    if (lastIndex === -1) {
        rows.push(newRow);
    } else {
        rows.splice(lastIndex + 1, 0, newRow); // insert after last record of that same driver 
    }

    //              rewrites whole text file again but with new row                                     
    fs.writeFileSync(textFile, rows.join("\n"), "utf8");

    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        metQuota: quota,
        hasBonus: false
    };
}





// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    let content = fs.readFileSync(textFile, "utf-8");
    let rows = content.split("\n");

    for (let i = 0; i < rows.length; i++) {
        let cols = rows[i].split(",");
        if (cols[0] === driverID && cols[2] === date) {
            cols[9] = newValue;
            rows[i] = cols.join(",");
        }
    }
    fs.writeFileSync(textFile, rows.join("\n"), "utf8");

}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    let content = fs.readFileSync(textFile, "utf-8");
    let rows = content.split("\n");

    let count = 0;
    let driverFound = false;

    for (let row of rows) {
        let cols = row.split(",");
        if (cols[0] === driverID) {
            driverFound = true;
            let rowMonth = cols[2].split("-")[1]; //extract month first!!!!

            //                                                  for \n
            if (parseInt(rowMonth) === parseInt(month) && cols[9].trim() === "true") {
                count++;
            }
        }
    }
    return driverFound ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let content = fs.readFileSync(textFile, "utf-8");
    let rows = content.split("\n");

    let totalSeconds = 0;

    for (let row of rows) {
        let cols = row.split(",");
        if (cols[0] === driverID) {
            let rowMonth = cols[2].split("-")[1]; 
            if (parseInt(rowMonth) === parseInt(month) ) {
                totalSeconds += toSecondsNoPeriod(cols[7]);
            }
        }
    }
    return formatTime(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let shiftContent = fs.readFileSync(textFile, "utf-8");
    let rateContent = fs.readFileSync(rateFile, "utf-8");
    
    let rows = shiftContent.split("\n");
    let rateRows = rateContent.split("\n");

    // Get drivers dayOFF from driverRtates.txt 
       let dayOff = null;
    for (let row of rateRows) {
        let cols = row.split(",");
        if (cols[0] === driverID) {
            dayOff = cols[1].trim();
            break;
        }
    }

    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    let totalSeconds = 0;
//loop through shifts on the given month
    for (let row of rows) {
        let cols = row.split(",");
        if (cols[0] === driverID) {
            let rowMonth = cols[2].split("-")[1];
            if (parseInt(rowMonth) === parseInt(month)) {
                //all this does is just know what day the date of the shift respresents
                let shiftDate = new Date(cols[2]);
                let shiftDayName = DAYS[shiftDate.getDay()];

                if (shiftDayName === dayOff) continue; 


                //calculating the hours part
                //mara wa7da to a number
                let [year, month, day] = cols[2].split("-").map(Number);
                if (year === 2025 && month === 4 && day >= 10 && day <= 30) {
                    totalSeconds += 6 * 3600; 
                } else {
                    totalSeconds += 8 * 3600 + 24 * 60; 
                }
            }
        }
    }

    // Subtract 2 hours per bonus
    totalSeconds -= bonusCount * 2 * 3600;
    return formatTime(totalSeconds);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};

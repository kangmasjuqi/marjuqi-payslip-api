// utils/helpers.js

/**
 * Converts a value to a safe floating-point number.
 * If the value cannot be parsed as a number, it returns 0.
 * @param {*} value - The input value to convert.
 * @returns {number} The parsed number or 0 if invalid.
 */
function safeNumber(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Counts the number of working days (Monday-Friday) between two dates, inclusive.
 * @param {string} startDateStr - The start date in a format parsable by new Date() (e.g., 'YYYY-MM-DD').
 * @param {string} endDateStr - The end date in a format parsable by new Date() (e.g., 'YYYY-MM-DD').
 * @returns {number} The number of working days.
 */
function countWorkingDays(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  let count = 0;

  // Loop through each day from start to end
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (day !== 0 && day !== 6) { // Exclude Sunday and Saturday
      count++;
    }
  }

  return count;
}

module.exports = {
  safeNumber,
  countWorkingDays,
};
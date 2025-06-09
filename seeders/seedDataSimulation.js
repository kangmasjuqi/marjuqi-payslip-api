'use strict';
const moment = require('moment');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const attendance = [];
    const overtime = [];
    const reimbursement = [];

    const ip = '127.0.0.1';
    const startDate = moment('2025-06-01');
    const endDate = moment('2025-06-30');
    const totalWorkingDays = countWorkingDays(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));

    await queryInterface.bulkInsert('payroll_periods', [{
        start_date: startDate.toDate(),
        end_date: endDate.toDate(),
        is_processed: false,
        created_by: 'admin',
        updated_by: 'admin',
        createdAt: moment().toDate(),
        updatedAt: moment().toDate(),
        ip_address: '127.0.0.1'
    }], { returning: true });

    const periodId = 1 // dummy

    for (let empId = 1; empId <= 100; empId++) {
      let currentDate = startDate.clone();
      let empWorkingDays = 0;

      while (currentDate.isSameOrBefore(endDate) && empWorkingDays < totalWorkingDays) {
        const weekday = currentDate.isoWeekday(); // 1 = Monday, 7 = Sunday

        // Attendance only on weekdays
        if (weekday <= 5) {
          attendance.push({
            employee_id: empId,
            date: currentDate.format('YYYY-MM-DD'),
            payroll_period_id: periodId,
            created_by: 'seeder',
            updated_by: 'seeder',
            ip_address: ip,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          empWorkingDays++;

            // Overtime 30% chance
          if (Math.random() < 0.3) {
            const otHours = (Math.random() * 3).toFixed(2); // up to 3.00 hours

            overtime.push({
              employee_id: empId,
              date: currentDate.format('YYYY-MM-DD'),
              hours: otHours,
              payroll_period_id: periodId,
              created_by: 'seeder',
              updated_by: 'seeder',
              ip_address: ip,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }

        currentDate.add(1, 'day');
      }

      // Reimbursements: 0–2 claims per employee
      const reimburseCount = Math.floor(Math.random() * 3); // 0, 1, or 2
      for (let i = 0; i < reimburseCount; i++) {
        const randomDate = moment(startDate)
          .add(Math.floor(Math.random() * 30), 'days')
          .format('YYYY-MM-DD');

        reimbursement.push({
          employee_id: empId,
          date: randomDate,
          amount: (Math.random() * 200 + 10).toFixed(2), // $10–$210
          description: `Expense for item ${Math.ceil(Math.random() * 100)}`,
          payroll_period_id: periodId,
          created_by: 'seeder',
          updated_by: 'seeder',
          ip_address: ip,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    console.log(`✅ Seeding ${attendance.length} attendance records...`);
    await queryInterface.bulkInsert('attendances', attendance);

    console.log(`✅ Seeding ${overtime.length} overtime records...`);
    await queryInterface.bulkInsert('overtimes', overtime);

    console.log(`✅ Seeding ${reimbursement.length} reimbursement records...`);
    await queryInterface.bulkInsert('reimbursements', reimbursement);


    function countWorkingDays(startDateStr, endDateStr) {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        let count = 0;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) count++; // Exclude Sunday (0) and Saturday (6)
        }

        return count;
    }        
        
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('attendances', { payroll_period_id: 1 });
    await queryInterface.bulkDelete('overtimes', { payroll_period_id: 1 });
    await queryInterface.bulkDelete('reimbursements', { payroll_period_id: 1 });
  }
};

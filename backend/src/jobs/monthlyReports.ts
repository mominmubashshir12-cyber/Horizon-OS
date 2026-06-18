import cron from 'node-cron';
import { generateAllMonthlyReports } from '../services/performanceService';

export function initMonthlyReports(): void {
  // End-of-month check for months with 28-31 days
  cron.schedule('0 20 28-31 * *', async () => {
    const today = new Date();
    const todayIST = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const tomorrow = new Date(todayIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (tomorrow.getDate() === 1) {
      const month = todayIST.getMonth() + 1; // 1-12
      const year = todayIST.getFullYear();
      console.log(`[MonthlyReports] Running end-of-month report generation for ${month}/${year}`);
      try {
        await generateAllMonthlyReports(month, year);
        console.log('[MonthlyReports] Completed end-of-month report generation');
      } catch (err) {
        console.error('[MonthlyReports] Error generating reports:', err);
      }
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Direct trigger on the 1st of the month
  cron.schedule('30 19 1 * *', async () => {
    const today = new Date();
    const todayIST = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    let month = todayIST.getMonth(); // 0-11
    let year = todayIST.getFullYear();
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    console.log(`[MonthlyReports] Running direct trigger report generation for ${month}/${year}`);
    try {
      await generateAllMonthlyReports(month, year);
      console.log('[MonthlyReports] Completed direct trigger report generation');
    } catch (err) {
      console.error('[MonthlyReports] Error generating reports:', err);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });
}

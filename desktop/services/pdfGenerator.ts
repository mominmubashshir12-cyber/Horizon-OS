import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiGet } from './api';

export const generatePayslipPdf = async (reportData: any) => {
  try {
    // Freshly fetch FirmSettings to get the latest working days and penalty rate
    const settingsRes = await apiGet<any>('/settings');
    let settings = {
      firmName: 'Horizon Technology Services',
      workingDaysPerMonth: 26,
      absentPenaltyRate: 1.0,
      firmAddress: '',
      firmPhone: '',
      firmGstin: ''
    };

    if (settingsRes.success && settingsRes.data) {
      settings = { ...settings, ...settingsRes.data };
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text(settings.firmName, 14, 22);
    
    doc.setFontSize(10);
    if (settings.firmAddress) doc.text(settings.firmAddress, 14, 30);
    if (settings.firmPhone) doc.text(`Phone: ${settings.firmPhone}`, 14, 35);
    if (settings.firmGstin) doc.text(`GSTIN: ${settings.firmGstin}`, 14, 40);

    // Title
    doc.setFontSize(16);
    doc.text('PAYSLIP', 150, 22);
    
    // Period details
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[reportData.month - 1];
    
    doc.setFontSize(10);
    doc.text(`Period: ${monthName} ${reportData.year}`, 150, 30);
    doc.text(`Date Generated: ${new Date().toLocaleDateString('en-IN')}`, 150, 35);

    // Employee Details
    doc.setFontSize(12);
    doc.text('Employee Details:', 14, 55);
    doc.setFontSize(10);
    doc.text(`Name: ${reportData.user?.fullName || 'N/A'}`, 14, 62);
    doc.text(`Role: ${reportData.user?.role?.replace('_', ' ') || 'N/A'}`, 14, 67);

    // Calculate details based on settings
    const baseSalary = reportData.baseSalary || 0;
    const workingDays = settings.workingDaysPerMonth;
    const perDaySalary = baseSalary / workingDays;
    
    // Absent deduction = total absent days * per day salary * absentPenaltyRate
    const absentDeduction = reportData.totalAbsent * perDaySalary * settings.absentPenaltyRate;
    
    // Any other deductions
    const otherDeduction = (reportData.deductionAmount || 0) - absentDeduction;

    const formatCurr = (val: number) => val.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Days/Amount', 'Total']],
      body: [
        ['Base Salary', '', formatCurr(baseSalary)],
        [`Working Days in Month`, workingDays.toString(), ''],
        [`Present Days`, reportData.totalPresent.toString(), ''],
        [`Absent Days (${settings.absentPenaltyRate}x penalty)`, reportData.totalAbsent.toString(), `-${formatCurr(absentDeduction)}`],
        [`Other Deductions (${reportData.deductionReason || 'N/A'})`, '', `-${formatCurr(otherDeduction > 0 ? otherDeduction : 0)}`],
        [`Bonus/Incentives (${reportData.bonusReason || 'N/A'})`, '', `+${formatCurr(reportData.bonusAmount || 0)}`],
      ],
      foot: [
        ['Net Salary Payable', '', formatCurr(reportData.finalSalary || 0)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [41, 128, 185], fontStyle: 'bold' },
    });

    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 100;
    
    doc.setFontSize(9);
    doc.text('This is a computer generated document and requires no signature.', 14, finalY + 20);

    doc.save(`Payslip_${reportData.user?.fullName?.replace(' ', '_') || 'Employee'}_${monthName}_${reportData.year}.pdf`);
    
    return { success: true };
  } catch (error) {
    console.error('PDF Generation error:', error);
    return { success: false, error };
  }
};

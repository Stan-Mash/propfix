import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Share } from 'react-native';

/**
 * Downloads a file from a remote URL and opens the system share sheet.
 * Works for PDFs and images / user can save to Files, send via WhatsApp, email, etc.
 */
export async function downloadAndShare(remoteUrl, filename) {
  try {
    const localUri = FileSystem.cacheDirectory + filename;
    const existing = await FileSystem.getInfoAsync(localUri);
    if (!existing.exists) {
      await FileSystem.downloadAsync(remoteUrl, localUri);
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Sharing not available', 'This device does not support file sharing.');
      return;
    }
    await Sharing.shareAsync(localUri, {
      mimeType: filename.endsWith('.pdf') ? 'application/pdf' : 'image/*',
      dialogTitle: 'Save or share quotation',
      UTI: filename.endsWith('.pdf') ? 'com.adobe.pdf' : 'public.image',
    });
  } catch (e) {
    Alert.alert('Download Failed', e.message);
  }
}

/**
 * Generates a CSV report from a list of complaints and opens the share sheet.
 * The user can save to Files, email, or open in Excel/Sheets.
 */
export async function exportComplaintsReport(complaints, reportTitle = 'Complaints Report') {
  try {
    const headers = [
      'Title', 'Category', 'Property', 'Unit', 'Status',
      'Filed By', 'Filed Date', 'Quotation (KES)', 'Contractor', 'Last Updated',
    ];

    const rows = complaints.map(c => [
      c.title,
      c.category,
      c.propertyName,
      c.unitNumber || '',
      c.status,
      c.submittedByName,
      new Date(c.createdAt).toLocaleDateString('en-KE'),
      c.quotationAmount != null ? Number(c.quotationAmount).toLocaleString() : '',
      c.contractorName || '',
      new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-KE'),
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const filename = `PropertyFix_${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    const localUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(localUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Sharing not available', 'This device does not support file sharing.');
      return;
    }
    await Sharing.shareAsync(localUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export report',
      UTI: 'public.comma-separated-values-text',
    });
  } catch (e) {
    Alert.alert('Export Failed', e.message);
  }
}

/**
 * Shares a plain-text summary of a single complaint via the native share sheet
 * (WhatsApp, SMS, email, etc.).
 */
export async function shareComplaintSummary(complaint) {
  const statusLabel = {
    pending: 'Pending', under_review: 'Under Review', forwarded: 'Awaiting Approval',
    approved: 'Approved', rejected: 'Rejected', in_progress: 'In Progress', resolved: 'Resolved',
  }[complaint.status] || complaint.status;

  const lines = [
    `PropertyFix · Maintenance Report`,
    ``,
    `Title: ${complaint.title}`,
    `Property: ${complaint.propertyName}${complaint.unitNumber ? `, Unit ${complaint.unitNumber}` : ''}`,
    `Category: ${complaint.category}`,
    `Status: ${statusLabel}`,
    `Filed by: ${complaint.submittedByName}`,
    `Date: ${new Date(complaint.createdAt).toLocaleDateString('en-KE')}`,
  ];

  if (complaint.quotationAmount) {
    lines.push(`Quotation: KES ${Number(complaint.quotationAmount).toLocaleString()}`);
  }
  if (complaint.contractorName) {
    lines.push(`Contractor: ${complaint.contractorName}`);
  }

  await Share.share({ message: lines.join('\n') });
}

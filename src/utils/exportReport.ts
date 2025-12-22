import { format } from "date-fns";

interface ViewingReportData {
  profileName: string;
  parentName: string;
  totalMinutes: number;
  videosWatched: number;
  topContent: string[];
  dailyLimit: number | null;
  bedtime: string | null;
}

export const exportToCSV = (data: ViewingReportData[], filename: string) => {
  const headers = [
    "Profile Name",
    "Parent Name",
    "Total Minutes Watched",
    "Videos Watched",
    "Top Content",
    "Daily Limit (min)",
    "Bedtime",
  ];

  const rows = data.map((item) => [
    item.profileName,
    item.parentName,
    item.totalMinutes.toString(),
    item.videosWatched.toString(),
    item.topContent.join("; "),
    item.dailyLimit?.toString() || "Unlimited",
    item.bedtime || "Not set",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportToPDF = (data: ViewingReportData[], filename: string) => {
  // Create a printable HTML document
  const reportDate = format(new Date(), "MMMM d, yyyy");
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Kids Viewing Report - ${reportDate}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          color: #1a1a1a;
        }
        h1 {
          color: #7c3aed;
          border-bottom: 3px solid #7c3aed;
          padding-bottom: 10px;
        }
        .report-date {
          color: #666;
          margin-bottom: 30px;
        }
        .profile-card {
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          background: #fafafa;
        }
        .profile-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
        }
        .profile-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .profile-name {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }
        .parent-name {
          color: #666;
          font-size: 14px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 15px;
        }
        .stat-box {
          background: white;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #7c3aed;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
        }
        .top-content {
          margin-top: 10px;
        }
        .top-content-title {
          font-weight: 600;
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
        }
        .content-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .content-tag {
          background: #7c3aed20;
          color: #7c3aed;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
        }
        .limits-row {
          display: flex;
          gap: 20px;
          margin-top: 10px;
          font-size: 13px;
          color: #666;
        }
        @media print {
          body { padding: 20px; }
          .profile-card { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>🎬 Kids Viewing Report</h1>
      <p class="report-date">Generated on ${reportDate}</p>
      
      ${data.map((item) => `
        <div class="profile-card">
          <div class="profile-header">
            <div class="profile-avatar">👶</div>
            <div>
              <h2 class="profile-name">${item.profileName}</h2>
              <p class="parent-name">Parent: ${item.parentName}</p>
            </div>
          </div>
          
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${item.totalMinutes}</div>
              <div class="stat-label">Minutes Watched</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${item.videosWatched}</div>
              <div class="stat-label">Videos Watched</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${item.topContent.length}</div>
              <div class="stat-label">Unique Titles</div>
            </div>
          </div>
          
          ${item.topContent.length > 0 ? `
            <div class="top-content">
              <div class="top-content-title">Top Content:</div>
              <div class="content-tags">
                ${item.topContent.map((title) => `<span class="content-tag">${title}</span>`).join("")}
              </div>
            </div>
          ` : ""}
          
          <div class="limits-row">
            <span>⏱️ Daily Limit: ${item.dailyLimit ? `${item.dailyLimit} min` : "Unlimited"}</span>
            ${item.bedtime ? `<span>🌙 Bedtime: ${item.bedtime}</span>` : ""}
          </div>
        </div>
      `).join("")}
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

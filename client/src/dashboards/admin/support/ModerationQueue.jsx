import React from "react";
import {
	Search,
	RefreshCw,
	CheckCircle2,
	User,
} from "lucide-react";

export const MODERATION_STATUS_BADGES = {
	pending: "bg-rose-500/10 text-rose-300 border-rose-500/20",
	investigating: "bg-amber-500/10 text-amber-300 border-amber-500/20",
	actioned: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
	dismissed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default function ModerationQueue({
	reports,
	reportCounts,
	reportPagination,
	reportStatus,
	setReportStatus,
	reportReason,
	setReportReason,
	reportAssignee,
	setReportAssignee,
	reportSearch,
	setReportSearch,
	loadingReports,
	fetchReports,
	admins,
	onOpenReport,
}) {
	return (
		<div className="space-y-4">
			{/* KPI Summary Cards */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-white/[0.08] space-y-1">
					<span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
						Total Reports
					</span>
					<div className="text-xl font-bold font-geist text-white">
						{reportCounts.all || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-rose-500/20 space-y-1">
					<span className="text-[11px] font-medium text-rose-300 block uppercase tracking-wider">
						Pending
					</span>
					<div className="text-xl font-bold font-geist text-rose-400">
						{reportCounts.pending || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-amber-500/20 space-y-1">
					<span className="text-[11px] font-medium text-amber-300 block uppercase tracking-wider">
						Investigating
					</span>
					<div className="text-xl font-bold font-geist text-amber-400">
						{reportCounts.investigating || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-emerald-500/20 space-y-1">
					<span className="text-[11px] font-medium text-emerald-300 block uppercase tracking-wider">
						Actioned
					</span>
					<div className="text-xl font-bold font-geist text-emerald-400">
						{reportCounts.actioned || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-slate-500/20 space-y-1">
					<span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
						Dismissed
					</span>
					<div className="text-xl font-bold font-geist text-slate-300">
						{reportCounts.dismissed || 0}
					</div>
				</div>
			</div>

			{/* Filters Toolbar */}
			<div className="p-4 rounded-xl bg-[#110a22] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
				<div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
					<div className="relative flex-1 min-w-[200px]">
						<Search
							size={14}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
						/>
						<input
							type="text"
							placeholder="Search reporter, reported user, booking ID..."
							value={reportSearch}
							onChange={(e) => setReportSearch(e.target.value)}
							className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
						/>
					</div>

					{/* Status Filter */}
					<select
						value={reportStatus}
						onChange={(e) => setReportStatus(e.target.value)}
						className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
					>
						<option value="all">All Statuses</option>
						<option value="pending">Pending</option>
						<option value="investigating">Investigating</option>
						<option value="actioned">Actioned</option>
						<option value="dismissed">Dismissed</option>
					</select>

					{/* Reason Filter */}
					<select
						value={reportReason}
						onChange={(e) => setReportReason(e.target.value)}
						className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
					>
						<option value="all">All Reasons</option>
						<option value="harassment">Harassment</option>
						<option value="off_platform_payment">
							Off-Platform Payment
						</option>
						<option value="safety_threat">Safety Threat</option>
						<option value="no_show_extortion">Service Issues</option>
						<option value="other">Other</option>
					</select>

					{/* Assignee Filter */}
					<select
						value={reportAssignee}
						onChange={(e) => setReportAssignee(e.target.value)}
						className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
					>
						<option value="all">All Investigators</option>
						<option value="unassigned">Unassigned Only</option>
						<option value="me">Assigned to Me</option>
						{admins.map((adm) => (
							<option key={adm.id} value={adm.id}>
								{adm.name || adm.email}
							</option>
						))}
					</select>
				</div>

				<button
					onClick={() => fetchReports(1)}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition cursor-pointer"
				>
					<RefreshCw
						size={13}
						className={loadingReports ? "animate-spin text-rose-400" : ""}
					/>
					<span>Refresh</span>
				</button>
			</div>

			{/* Reports Table */}
			<div className="rounded-xl bg-[#110a22] border border-white/[0.08] overflow-hidden">
				{loadingReports ? (
					<div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
						<RefreshCw size={24} className="animate-spin text-rose-400" />
						<span>Loading moderation reports...</span>
					</div>
				) : reports.length === 0 ? (
					<div className="p-12 text-center text-slate-500 space-y-2">
						<CheckCircle2 size={32} className="mx-auto text-emerald-500/50" />
						<p className="text-sm font-semibold text-slate-300">
							No moderation reports found for this filter.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead className="bg-white/[0.03] border-b border-white/[0.06] text-slate-400 uppercase tracking-wider font-semibold">
								<tr>
									<th className="py-3 px-4">Reason &amp; ID</th>
									<th className="py-3 px-4">Reported User</th>
									<th className="py-3 px-4">Reported By</th>
									<th className="py-3 px-4">Booking Ref</th>
									<th className="py-3 px-4">Status</th>
									<th className="py-3 px-4">Investigator</th>
									<th className="py-3 px-4 text-right">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/[0.04]">
								{reports.map((r) => (
									<tr
										key={r.id}
										className="hover:bg-white/[0.02] transition"
									>
										<td className="py-3.5 px-4">
											<div className="flex items-center gap-1.5">
												<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
													{r.reason ? r.reason.replace(/_/g, " ") : "Safety"}
												</span>
											</div>
											<span className="text-[10px] font-mono text-slate-500 block mt-1">
												{new Date(r.created_at).toLocaleString()}
											</span>
										</td>
										<td className="py-3.5 px-4">
											<div className="font-semibold text-white">
												{r.reported_name}
											</div>
											<div className="text-[11px] text-slate-400">
												{r.reported_email}
											</div>
											<span className="text-[10px] text-amber-400 font-mono">
												{r.reported_custom_id || r.reported_role}
											</span>
										</td>
										<td className="py-3.5 px-4">
											<div className="font-medium text-slate-200">
												{r.reporter_name}
											</div>
											<div className="text-[11px] text-slate-400">
												{r.reporter_email}
											</div>
											<span className="text-[10px] text-slate-500 capitalize">
												{r.reporter_role}
											</span>
										</td>
										<td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
											#{r.booking_id ? r.booking_id.slice(0, 8).toUpperCase() : "-"}
										</td>
										<td className="py-3.5 px-4">
											<span
												className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
													MODERATION_STATUS_BADGES[r.status] ||
													MODERATION_STATUS_BADGES.pending
												}`}
											>
												{r.status || "pending"}
											</span>
										</td>
										<td className="py-3.5 px-4">
											{r.assigned_to_name ? (
												<span className="flex items-center gap-1.5 text-rose-300 font-medium">
													<User size={12} />
													{r.assigned_to_name}
												</span>
											) : (
												<span className="text-slate-500 italic">
													Unassigned
												</span>
											)}
										</td>
										<td className="py-3.5 px-4 text-right">
											<button
												onClick={() => onOpenReport(r)}
												className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition cursor-pointer shadow-sm"
											>
												Investigate &amp; Action
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination */}
				{reportPagination.pages > 1 && (
					<div className="p-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
						<span>
							Showing page {reportPagination.page} of {reportPagination.pages}{" "}
							({reportPagination.total} total)
						</span>
						<div className="flex gap-1.5">
							<button
								disabled={reportPagination.page <= 1}
								onClick={() => fetchReports(reportPagination.page - 1)}
								className="px-2.5 py-1 rounded bg-white/5 disabled:opacity-30 cursor-pointer"
							>
								Prev
							</button>
							<button
								disabled={reportPagination.page >= reportPagination.pages}
								onClick={() => fetchReports(reportPagination.page + 1)}
								className="px-2.5 py-1 rounded bg-white/5 disabled:opacity-30 cursor-pointer"
							>
								Next
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

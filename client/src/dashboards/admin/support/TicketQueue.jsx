import React from "react";
import {
	Search,
	RefreshCw,
	CheckCircle2,
	User,
	MessageSquare,
} from "lucide-react";

export const TICKET_STATUS_BADGES = {
	open: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
	in_progress: "bg-amber-500/10 text-amber-300 border-amber-500/20",
	resolved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
	closed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export const TICKET_PRIORITY_BADGES = {
	urgent: "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold",
	high: "bg-amber-500/20 text-amber-300 border-amber-500/40",
	normal: "bg-slate-500/10 text-slate-300 border-white/10",
	low: "bg-slate-800 text-slate-400 border-transparent",
};

export default function TicketQueue({
	tickets,
	ticketCounts,
	ticketPagination,
	ticketStatus,
	setTicketStatus,
	ticketPriority,
	setTicketPriority,
	ticketCategory,
	setTicketCategory,
	ticketAssignee,
	setTicketAssignee,
	ticketSearch,
	setTicketSearch,
	loadingTickets,
	fetchTickets,
	admins,
	onOpenTicket,
}) {
	return (
		<div className="space-y-4">
			{/* KPI Summary Cards */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-white/[0.08] space-y-1">
					<span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
						All Tickets
					</span>
					<div className="text-xl font-bold font-geist text-white">
						{ticketCounts.all || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-cyan-500/20 space-y-1">
					<span className="text-[11px] font-medium text-cyan-300 block uppercase tracking-wider">
						Open
					</span>
					<div className="text-xl font-bold font-geist text-cyan-400">
						{ticketCounts.open || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-amber-500/20 space-y-1">
					<span className="text-[11px] font-medium text-amber-300 block uppercase tracking-wider">
						In Progress
					</span>
					<div className="text-xl font-bold font-geist text-amber-400">
						{ticketCounts.in_progress || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-rose-500/20 space-y-1">
					<span className="text-[11px] font-medium text-rose-300 block uppercase tracking-wider">
						Unassigned
					</span>
					<div className="text-xl font-bold font-geist text-rose-400">
						{ticketCounts.unassigned || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-emerald-500/20 space-y-1">
					<span className="text-[11px] font-medium text-emerald-300 block uppercase tracking-wider">
						Resolved
					</span>
					<div className="text-xl font-bold font-geist text-emerald-400">
						{ticketCounts.resolved || 0}
					</div>
				</div>
				<div className="p-3.5 rounded-xl bg-[#110a22] border border-slate-500/20 space-y-1">
					<span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
						Closed
					</span>
					<div className="text-xl font-bold font-geist text-slate-300">
						{ticketCounts.closed || 0}
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
							placeholder="Search ticket #, subject, email..."
							value={ticketSearch}
							onChange={(e) => setTicketSearch(e.target.value)}
							className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
						/>
					</div>

					{/* Status Filter */}
					<select
						value={ticketStatus}
						onChange={(e) => setTicketStatus(e.target.value)}
						className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
					>
						<option value="all">All Statuses</option>
						<option value="open">Open</option>
						<option value="in_progress">In Progress</option>
						<option value="resolved">Resolved</option>
						<option value="closed">Closed</option>
					</select>

					{/* Priority Filter */}
					<select
						value={ticketPriority}
						onChange={(e) => setTicketPriority(e.target.value)}
						className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
					>
						<option value="all">All Priorities</option>
						<option value="urgent">Urgent</option>
						<option value="high">High</option>
						<option value="normal">Normal</option>
						<option value="low">Low</option>
					</select>

					{/* Category Filter */}
					<select
						value={ticketCategory}
						onChange={(e) => setTicketCategory(e.target.value)}
						className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
					>
						<option value="all">All Categories</option>
						<option value="booking">Bookings</option>
						<option value="refund">Refunds & Payments</option>
						<option value="kyc">KYC & Identity</option>
						<option value="payout">Payouts</option>
						<option value="technical">Technical</option>
						<option value="general">General</option>
					</select>

					{/* Assignee Filter */}
					<select
						value={ticketAssignee}
						onChange={(e) => setTicketAssignee(e.target.value)}
						className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
					>
						<option value="all">All Ownership</option>
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
					onClick={() => fetchTickets(1)}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition cursor-pointer"
				>
					<RefreshCw
						size={13}
						className={loadingTickets ? "animate-spin text-violet-400" : ""}
					/>
					<span>Refresh</span>
				</button>
			</div>

			{/* Tickets Table */}
			<div className="rounded-xl bg-[#110a22] border border-white/[0.08] overflow-hidden">
				{loadingTickets ? (
					<div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
						<RefreshCw size={24} className="animate-spin text-violet-400" />
						<span>Loading support tickets queue...</span>
					</div>
				) : tickets.length === 0 ? (
					<div className="p-12 text-center text-slate-500 space-y-2">
						<CheckCircle2 size={32} className="mx-auto text-emerald-500/50" />
						<p className="text-sm font-semibold text-slate-300">
							Work queue clean! No tickets match these criteria.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead className="bg-white/[0.03] border-b border-white/[0.06] text-slate-400 uppercase tracking-wider font-semibold">
								<tr>
									<th className="py-3 px-4">Ticket</th>
									<th className="py-3 px-4">Subject &amp; Category</th>
									<th className="py-3 px-4">Requester</th>
									<th className="py-3 px-4">Priority</th>
									<th className="py-3 px-4">Status</th>
									<th className="py-3 px-4">Assignee</th>
									<th className="py-3 px-4">Replies</th>
									<th className="py-3 px-4 text-right">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/[0.04]">
								{tickets.map((t) => (
									<tr
										key={t.id}
										className="hover:bg-white/[0.02] transition"
									>
										<td className="py-3.5 px-4 font-mono font-bold text-violet-300">
											#{t.ticket_number}
											<span className="block text-[10px] font-sans text-slate-500 font-normal">
												{new Date(t.created_at).toLocaleDateString()}
											</span>
										</td>
										<td className="py-3.5 px-4 max-w-[240px]">
											<div className="font-semibold text-white truncate">
												{t.subject}
											</div>
											<span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] bg-white/[0.06] text-slate-300 capitalize">
												{t.category ? t.category.replace("_", " ") : "General"}
											</span>
										</td>
										<td className="py-3.5 px-4">
											<div className="font-medium text-slate-200">
												{t.name}
											</div>
											<div className="text-[11px] text-slate-400 truncate max-w-[150px]">
												{t.email}
											</div>
											<span className="text-[10px] text-slate-500 capitalize">
												{t.role || "customer"}
											</span>
										</td>
										<td className="py-3.5 px-4">
											<span
												className={`px-2 py-0.5 rounded-full text-[10px] border capitalize ${
													TICKET_PRIORITY_BADGES[t.priority] ||
													TICKET_PRIORITY_BADGES.normal
												}`}
											>
												{t.priority || "normal"}
											</span>
										</td>
										<td className="py-3.5 px-4">
											<span
												className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
													TICKET_STATUS_BADGES[t.status] || TICKET_STATUS_BADGES.open
												}`}
											>
												{t.status ? t.status.replace("_", " ") : "open"}
											</span>
										</td>
										<td className="py-3.5 px-4">
											{t.assigned_to_name ? (
												<span className="flex items-center gap-1.5 text-violet-300 font-medium">
													<User size={12} />
													{t.assigned_to_name}
												</span>
											) : (
												<span className="text-slate-500 italic">
													Unassigned
												</span>
											)}
										</td>
										<td className="py-3.5 px-4">
											<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 font-mono text-[11px]">
												<MessageSquare size={11} />
												{t.reply_count || 0}
											</span>
										</td>
										<td className="py-3.5 px-4 text-right">
											<button
												onClick={() => onOpenTicket(t)}
												className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition cursor-pointer shadow-sm"
											>
												Review &amp; Reply
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination */}
				{ticketPagination.pages > 1 && (
					<div className="p-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
						<span>
							Showing page {ticketPagination.page} of {ticketPagination.pages}{" "}
							({ticketPagination.total} total)
						</span>
						<div className="flex gap-1.5">
							<button
								disabled={ticketPagination.page <= 1}
								onClick={() => fetchTickets(ticketPagination.page - 1)}
								className="px-2.5 py-1 rounded bg-white/5 disabled:opacity-30 cursor-pointer"
							>
								Prev
							</button>
							<button
								disabled={ticketPagination.page >= ticketPagination.pages}
								onClick={() => fetchTickets(ticketPagination.page + 1)}
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

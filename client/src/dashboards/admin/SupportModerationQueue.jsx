import React, { useState, useEffect, useCallback, useRef } from "react";
import {
	LifeBuoy,
	MessageSquare,
	ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../api/axiosInstance";
import TicketQueue from "./support/TicketQueue";
import TicketDrawer from "./support/TicketDrawer";
import ModerationQueue from "./support/ModerationQueue";
import ReportDrawer from "./support/ReportDrawer";

export default function SupportModerationQueue({ user, onUpdateOverview }) {
	const [activeSubTab, setActiveSubTab] = useState("tickets"); // "tickets" | "reports"

	// -------------------------------------------------------------
	// Support Tickets State
	// -------------------------------------------------------------
	const [tickets, setTickets] = useState([]);
	const [ticketCounts, setTicketCounts] = useState({
		all: 0,
		open: 0,
		in_progress: 0,
		resolved: 0,
		closed: 0,
		unassigned: 0,
	});
	const [ticketPagination, setTicketPagination] = useState({
		page: 1,
		pages: 1,
		total: 0,
	});
	const [ticketStatus, setTicketStatus] = useState("all");
	const [ticketPriority, setTicketPriority] = useState("all");
	const [ticketCategory, setTicketCategory] = useState("all");
	const [ticketAssignee, setTicketAssignee] = useState("all");
	const [ticketSearch, setTicketSearch] = useState("");
	const [debouncedTicketSearch, setDebouncedTicketSearch] = useState("");
	const [loadingTickets, setLoadingTickets] = useState(false);

	// Active Ticket Drawer State
	const [selectedTicket, setSelectedTicket] = useState(null);
	const [ticketReplies, setTicketReplies] = useState([]);
	const [loadingTicketThread, setLoadingTicketThread] = useState(false);
	const [replyMessage, setReplyMessage] = useState("");
	const [isInternalNote, setIsInternalNote] = useState(false);
	const [replyStatusTransition, setReplyStatusTransition] = useState("");
	const [submittingReply, setSubmittingReply] = useState(false);
	const [ticketResolutionNote, setTicketResolutionNote] = useState("");
	const [showTicketResolveModal, setShowTicketResolveModal] = useState(false);

	// -------------------------------------------------------------
	// Chat Moderation Reports State
	// -------------------------------------------------------------
	const [reports, setReports] = useState([]);
	const [reportCounts, setReportCounts] = useState({
		all: 0,
		pending: 0,
		investigating: 0,
		actioned: 0,
		dismissed: 0,
		unassigned: 0,
	});
	const [reportPagination, setReportPagination] = useState({
		page: 1,
		pages: 1,
		total: 0,
	});
	const [reportStatus, setReportStatus] = useState("all");
	const [reportReason, setReportReason] = useState("all");
	const [reportAssignee, setReportAssignee] = useState("all");
	const [reportSearch, setReportSearch] = useState("");
	const [debouncedReportSearch, setDebouncedReportSearch] = useState("");
	const [loadingReports, setLoadingReports] = useState(false);

	// Active Report Drawer State
	const [selectedReport, setSelectedReport] = useState(null);
	const [reportMessages, setReportMessages] = useState([]);
	const [loadingReportDetails, setLoadingReportDetails] = useState(false);
	const [actionModal, setActionModal] = useState({
		isOpen: false,
		type: "",
		warningMessage: "",
		notes: "",
	});
	const [actionInProgress, setActionInProgress] = useState(false);

	// Admins List
	const [admins, setAdmins] = useState([]);

	// AbortController refs to cancel stale requests
	const ticketsAbortRef = useRef(null);
	const reportsAbortRef = useRef(null);

	// -------------------------------------------------------------
	// 1. Debounce Search Inputs
	// -------------------------------------------------------------
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedTicketSearch(ticketSearch);
		}, 300);
		return () => clearTimeout(timer);
	}, [ticketSearch]);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedReportSearch(reportSearch);
		}, 300);
		return () => clearTimeout(timer);
	}, [reportSearch]);

	// -------------------------------------------------------------
	// 2. Fetch Administrators
	// -------------------------------------------------------------
	useEffect(() => {
		async function loadAdmins() {
			try {
				const res = await api.get("/api/admin/admins");
				if (res.data?.success) {
					setAdmins(res.data.admins || []);
				}
			} catch (err) {
				console.warn("Could not load admins list:", err);
			}
		}
		loadAdmins();
	}, []);

	// -------------------------------------------------------------
	// 3. Fetch Support Tickets with Cancellation of Stale In-Flight
	// -------------------------------------------------------------
	const fetchTickets = useCallback(
		async (page = 1) => {
			if (ticketsAbortRef.current) {
				ticketsAbortRef.current.abort();
			}
			const controller = new AbortController();
			ticketsAbortRef.current = controller;

			setLoadingTickets(true);
			try {
				const params = {
					status: ticketStatus,
					priority: ticketPriority,
					category: ticketCategory,
					assigned_to: ticketAssignee,
					search: debouncedTicketSearch.trim(),
					page,
					limit: 15,
				};
				const res = await api.get("/api/admin/support/tickets", {
					params,
					signal: controller.signal,
				});
				if (res.data?.success) {
					setTickets(res.data.tickets || []);
					setTicketCounts(res.data.counts || {});
					setTicketPagination(
						res.data.pagination || { page: 1, pages: 1, total: 0 }
					);
				}
			} catch (err) {
				if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
				console.error("Failed to load support tickets:", err);
				toast.error("Could not load support tickets queue");
			} finally {
				setLoadingTickets(false);
			}
		},
		[
			ticketStatus,
			ticketPriority,
			ticketCategory,
			ticketAssignee,
			debouncedTicketSearch,
		]
	);

	// -------------------------------------------------------------
	// 4. Fetch Moderation Reports with Cancellation of Stale In-Flight
	// -------------------------------------------------------------
	const fetchReports = useCallback(
		async (page = 1) => {
			if (reportsAbortRef.current) {
				reportsAbortRef.current.abort();
			}
			const controller = new AbortController();
			reportsAbortRef.current = controller;

			setLoadingReports(true);
			try {
				const params = {
					status: reportStatus,
					reason: reportReason,
					assigned_to: reportAssignee,
					search: debouncedReportSearch.trim(),
					page,
					limit: 15,
				};
				const res = await api.get("/api/admin/moderation/reports", {
					params,
					signal: controller.signal,
				});
				if (res.data?.success) {
					setReports(res.data.reports || []);
					setReportCounts(res.data.counts || {});
					setReportPagination(
						res.data.pagination || { page: 1, pages: 1, total: 0 }
					);
				}
			} catch (err) {
				if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
				console.error("Failed to load moderation reports:", err);
				toast.error("Could not load moderation reports");
			} finally {
				setLoadingReports(false);
			}
		},
		[
			reportStatus,
			reportReason,
			reportAssignee,
			debouncedReportSearch,
		]
	);

	useEffect(() => {
		if (activeSubTab === "tickets") {
			fetchTickets(1);
		} else {
			fetchReports(1);
		}
	}, [activeSubTab, fetchTickets, fetchReports]);

	// Open Ticket Drawer & load conversation thread
	const handleOpenTicket = async (ticket) => {
		setSelectedTicket(ticket);
		setLoadingTicketThread(true);
		setReplyMessage("");
		setIsInternalNote(false);
		setReplyStatusTransition("");
		try {
			const res = await api.get(`/api/admin/support/tickets/${ticket.id}`);
			if (res.data?.success) {
				setSelectedTicket(res.data.ticket);
				setTicketReplies(res.data.replies || []);
			}
		} catch (err) {
			console.error("Failed to load ticket thread:", err);
			toast.error("Could not load full ticket thread");
		} finally {
			setLoadingTicketThread(false);
		}
	};

	// Assign Support Ticket
	const handleAssignTicket = async (ticketId, assigneeId) => {
		try {
			const res = await api.put(
				`/api/admin/support/tickets/${ticketId}/assign`,
				{
					assigned_to: assigneeId,
				}
			);
			if (res.data?.success) {
				toast.success(res.data.message || "Ticket reassigned");
				setSelectedTicket((prev) =>
					prev?.id === ticketId ? { ...prev, ...res.data.ticket } : prev
				);
				fetchTickets(ticketPagination.page);
				if (onUpdateOverview) onUpdateOverview();
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to assign ticket");
		}
	};

	// Post Ticket Reply / Internal Note
	const handleSendReply = async (e) => {
		e.preventDefault();
		if (!replyMessage.trim() || submittingReply) return;
		setSubmittingReply(true);
		try {
			const res = await api.post(
				`/api/admin/support/tickets/${selectedTicket.id}/replies`,
				{
					message: replyMessage.trim(),
					is_internal: isInternalNote,
					status: replyStatusTransition || undefined,
				}
			);
			if (res.data?.success) {
				toast.success(
					isInternalNote
						? "Internal note recorded"
						: "Reply sent to customer"
				);
				setReplyMessage("");
				setReplyStatusTransition("");
				if (res.data.ticket) {
					setSelectedTicket((prev) => ({ ...prev, ...res.data.ticket }));
				}
				handleOpenTicket(res.data.ticket || selectedTicket);
				fetchTickets(ticketPagination.page);
				if (onUpdateOverview) onUpdateOverview();
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to submit reply");
		} finally {
			setSubmittingReply(false);
		}
	};

	// Resolve / Update Support Ticket Status
	const handleResolveTicket = async (status, notes) => {
		try {
			const res = await api.put(
				`/api/admin/support/tickets/${selectedTicket.id}/resolve`,
				{
					status,
					resolution_notes: notes,
				}
			);
			if (res.data?.success) {
				toast.success(`Ticket marked as ${status}`);
				setSelectedTicket((prev) => ({ ...prev, ...res.data.ticket }));
				setShowTicketResolveModal(false);
				setTicketResolutionNote("");
				handleOpenTicket(res.data.ticket);
				fetchTickets(ticketPagination.page);
				if (onUpdateOverview) onUpdateOverview();
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to update status");
		}
	};

	// Open Moderation Report Drawer
	const handleOpenReport = async (report) => {
		setSelectedReport(report);
		setLoadingReportDetails(true);
		try {
			const res = await api.get(`/api/admin/moderation/reports/${report.id}`);
			if (res.data?.success) {
				setSelectedReport((prev) => ({ ...prev, ...res.data.report }));
				setReportMessages(res.data.messages || []);
			}
		} catch (err) {
			console.error("Failed to load report details:", err);
			toast.error("Could not load report conversation");
		} finally {
			setLoadingReportDetails(false);
		}
	};

	// Assign Moderation Report (merges returned fields so reported_role is never lost)
	const handleAssignReport = async (reportId, assigneeId) => {
		try {
			const res = await api.put(
				`/api/admin/moderation/reports/${reportId}/assign`,
				{
					assigned_to: assigneeId,
				}
			);
			if (res.data?.success) {
				toast.success(res.data.message || "Report assigned");
				setSelectedReport((prev) =>
					prev?.id === reportId ? { ...prev, ...res.data.report } : prev
				);
				fetchReports(reportPagination.page);
				if (onUpdateOverview) onUpdateOverview();
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to assign report");
		}
	};

	// Execute Action on Moderation Report
	const handleExecuteAction = async () => {
		if (!selectedReport || actionInProgress) return;
		setActionInProgress(true);
		try {
			const res = await api.post(
				`/api/admin/moderation/reports/${selectedReport.id}/action`,
				{
					action: actionModal.type,
					warning_message: actionModal.warningMessage,
					notes: actionModal.notes,
				}
			);
			if (res.data?.success) {
				toast.success(res.data.message || "Action applied successfully");
				setSelectedReport((prev) => ({ ...prev, ...res.data.report }));
				setActionModal({
					isOpen: false,
					type: "",
					warningMessage: "",
					notes: "",
				});
				fetchReports(reportPagination.page);
				if (onUpdateOverview) onUpdateOverview();
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to execute action");
		} finally {
			setActionInProgress(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Top Header & Sub-Tab Switcher */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h2 className="font-mackinac text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
						<LifeBuoy className="text-violet-400" size={24} />
						Support &amp; Moderation Work Queue
					</h2>
					<p className="font-bricolage text-xs sm:text-sm text-slate-400 mt-0.5">
						Track customer tickets, manage staff ownership, and investigate
						chat safety reports.
					</p>
				</div>

				<div className="flex items-center gap-2 p-1 bg-[#130b28] rounded-xl border border-white/10 self-start md:self-auto">
					<button
						onClick={() => setActiveSubTab("tickets")}
						className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							activeSubTab === "tickets"
								? "bg-violet-600 text-white shadow-md shadow-violet-900/30"
								: "text-slate-400 hover:text-white"
						}`}
					>
						<MessageSquare size={14} />
						<span>Support Tickets</span>
						{ticketCounts.open + ticketCounts.in_progress > 0 && (
							<span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
								{ticketCounts.open + ticketCounts.in_progress}
							</span>
						)}
					</button>

					<button
						onClick={() => setActiveSubTab("reports")}
						className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							activeSubTab === "reports"
								? "bg-rose-600 text-white shadow-md shadow-rose-900/30"
								: "text-slate-400 hover:text-white"
						}`}
					>
						<ShieldAlert size={14} />
						<span>Chat Reports &amp; Safety</span>
						{reportCounts.pending + reportCounts.investigating > 0 && (
							<span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
								{reportCounts.pending + reportCounts.investigating}
							</span>
						)}
					</button>
				</div>
			</div>

			{/* Sub-tab 1: Support Tickets */}
			{activeSubTab === "tickets" && (
				<TicketQueue
					tickets={tickets}
					ticketCounts={ticketCounts}
					ticketPagination={ticketPagination}
					ticketStatus={ticketStatus}
					setTicketStatus={setTicketStatus}
					ticketPriority={ticketPriority}
					setTicketPriority={setTicketPriority}
					ticketCategory={ticketCategory}
					setTicketCategory={setTicketCategory}
					ticketAssignee={ticketAssignee}
					setTicketAssignee={setTicketAssignee}
					ticketSearch={ticketSearch}
					setTicketSearch={setTicketSearch}
					loadingTickets={loadingTickets}
					fetchTickets={fetchTickets}
					admins={admins}
					onOpenTicket={handleOpenTicket}
				/>
			)}

			{/* Sub-tab 2: Moderation Reports */}
			{activeSubTab === "reports" && (
				<ModerationQueue
					reports={reports}
					reportCounts={reportCounts}
					reportPagination={reportPagination}
					reportStatus={reportStatus}
					setReportStatus={setReportStatus}
					reportReason={reportReason}
					setReportReason={setReportReason}
					reportAssignee={reportAssignee}
					setReportAssignee={setReportAssignee}
					reportSearch={reportSearch}
					setReportSearch={setReportSearch}
					loadingReports={loadingReports}
					fetchReports={fetchReports}
					admins={admins}
					onOpenReport={handleOpenReport}
				/>
			)}

			{/* Ticket Drawer */}
			<TicketDrawer
				selectedTicket={selectedTicket}
				onClose={() => setSelectedTicket(null)}
				ticketReplies={ticketReplies}
				loadingTicketThread={loadingTicketThread}
				admins={admins}
				currentUserId={user?.id}
				onAssign={handleAssignTicket}
				onSendReply={handleSendReply}
				replyMessage={replyMessage}
				setReplyMessage={setReplyMessage}
				isInternalNote={isInternalNote}
				setIsInternalNote={setIsInternalNote}
				replyStatusTransition={replyStatusTransition}
				setReplyStatusTransition={setReplyStatusTransition}
				submittingReply={submittingReply}
				onResolve={handleResolveTicket}
				showResolveModal={showTicketResolveModal}
				setShowResolveModal={setShowTicketResolveModal}
				resolutionNotes={ticketResolutionNote}
				setResolutionNotes={setTicketResolutionNote}
			/>

			{/* Report Drawer */}
			<ReportDrawer
				selectedReport={selectedReport}
				onClose={() => setSelectedReport(null)}
				reportMessages={reportMessages}
				loadingReportDetails={loadingReportDetails}
				admins={admins}
				currentUserId={user?.id}
				onAssign={handleAssignReport}
				actionModal={actionModal}
				setActionModal={setActionModal}
				actionInProgress={actionInProgress}
				onExecuteAction={handleExecuteAction}
			/>
		</div>
	);
}

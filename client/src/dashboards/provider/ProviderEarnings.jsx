import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
	IndianRupee,
	TrendingUp,
	TrendingDown,
	CheckCircle2,
	Calendar,
	Clock,
	ChevronRight,
	Download,
	BarChart3,
	ArrowUpRight,
	ArrowDownRight,
	ShieldCheck,
	Activity,
	CreditCard,
	FileText,
	ChevronLeft,
} from "lucide-react";
import api from "../../api/axiosInstance";

import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	Tooltip,
	Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	Tooltip,
	Legend,
);

const formatCurrency = (n) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(n || 0);

export default function ProviderEarnings() {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(true);
	const [summary, setSummary] = useState({
		total_earnings: 0,
		this_month: 0,
		last_month: 0,
		pending_payout: 0,
		completed_jobs: 0,
		growth_pct: null,
	});
	const [monthlyData, setMonthlyData] = useState([]);
	const [transactions, setTransactions] = useState([]);
	const [txPage, setTxPage] = useState(1);
	const [txMeta, setTxMeta] = useState({
		total_pages: 1,
		has_next_page: false,
	});
	const [txLoading, setTxLoading] = useState(false);

	useEffect(() => {
		const load = async () => {
			try {
				const [summaryRes, monthlyRes] = await Promise.allSettled([
					api.get("/api/earnings/provider/summary"),
					api.get("/api/earnings/provider/monthly"),
				]);
				if (summaryRes.status === "fulfilled")
					setSummary(summaryRes.value.data || {});
				if (monthlyRes.status === "fulfilled")
					setMonthlyData(monthlyRes.value.data || []);
			} catch (err) {
				console.error("Earnings load error:", err);
			} finally {
				setIsLoading(false);
			}
		};
		load();
	}, []);

	useEffect(() => {
		const loadTx = async () => {
			setTxLoading(true);
			try {
				const res = await api.get(
					`/api/earnings/provider/transactions?page=${txPage}&limit=10`,
				);
				setTransactions(res.data?.data || []);
				setTxMeta(res.data?.meta || {});
			} catch (err) {
				console.error("Transaction load error:", err);
			} finally {
				setTxLoading(false);
			}
		};
		loadTx();
	}, [txPage]);

	const growthPositive = (summary.growth_pct ?? 0) >= 0;

	// Export CSV
	const handleExportCSV = () => {
		if (transactions.length === 0) {
			toast.error("No transactions to export");
			return;
		}
		const headers = "Date,Booking ID,Service,Type,Amount (INR)\n";
		const rows = transactions
			.map(
				(t) =>
					`"${t.date || t.created_at || ""}","${t.booking_id || ""}","${t.description || t.service_name || "Job"}","${t.type || "credit"}","${t.amount || 0}"`,
			)
			.join("\n");
		const blob = new Blob([headers + rows], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `earnings-report-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Transaction statement exported as CSV");
	};

	const chartData = {
		labels: monthlyData.map((m) => m.label),
		datasets: [
			{
				label: "Gross Revenue",
				data: monthlyData.map((m) => m.amount),
				backgroundColor: "rgba(124, 58, 237, 0.4)",
				borderColor: "rgba(168, 85, 247, 0.9)",
				borderWidth: 1.5,
				borderRadius: 8,
				hoverBackgroundColor: "rgba(124, 58, 237, 0.7)",
			},
		],
	};

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false },
			tooltip: {
				backgroundColor: "#140b28",
				titleColor: "#94a3b8",
				bodyColor: "#f8fafc",
				borderColor: "rgba(255,255,255,0.1)",
				borderWidth: 1,
				padding: 12,
				cornerRadius: 12,
				displayColors: false,
				callbacks: {
					label: function (context) {
						return ` Gross Volume: ${formatCurrency(context.raw)}`;
					},
				},
			},
		},
		scales: {
			x: {
				grid: { display: false },
				ticks: { color: "#64748b", font: { size: 11, weight: "bold" } },
			},
			y: {
				grid: { color: "rgba(255,255,255,0.04)" },
				ticks: {
					color: "#64748b",
					font: { size: 10 },
					callback: (v) => `₹${v}`,
				},
			},
		},
	};

	if (isLoading) {
		return <EarningsSkeleton />;
	}

	const estimatedNetRetention = Math.round(
		(summary.total_earnings || 0) * 0.85,
	);

	return (
		<div className="space-y-8">
			{/* Top Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
				<div>
					<div className="flex items-center gap-2.5">
						<h1 className="font-mackinac text-2xl sm:text-3xl font-black text-white tracking-tight">
							Payouts & Finance Engine
						</h1>
						<span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-300 border border-violet-500/25">
							Direct Bank Deposit
						</span>
					</div>
					<p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
						Audited transaction reconciliation, fee deductions, and scheduled
						payouts.
					</p>
				</div>

				<div className="flex items-center gap-2.5">
					<button
						onClick={handleExportCSV}
						className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] text-xs font-bold transition-all cursor-pointer"
					>
						<Download size={14} className="text-violet-400" />
						<span>Export CSV Statement</span>
					</button>
				</div>
			</div>

			{/* Financial Telemetry Architecture */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
				{/* Main Payout Card (7 Cols) */}
				<div className="lg:col-span-7 p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#160d31] to-[#0e0820] border border-violet-500/20 shadow-xl shadow-black/50 relative overflow-hidden flex flex-col justify-between space-y-6">
					<div className="flex items-center justify-between">
						<span className="text-[11px] font-extrabold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
							<ShieldCheck size={14} className="text-emerald-400" />
							Net Realized Income
						</span>
						<span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
							Automatic Weekly Payout
						</span>
					</div>

					<div className="space-y-1">
						<div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
							{formatCurrency(estimatedNetRetention)}
						</div>
						<p className="text-xs text-slate-400">
							Gross Platform Revenue:{" "}
							<span className="font-bold text-slate-200">
								{formatCurrency(summary.total_earnings)}
							</span>{" "}
							(less standard 15% marketplace commission)
						</p>
					</div>

					{/* 3 Metrics Ribbon */}
					<div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.06]">
						<div>
							<span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
								This Month
							</span>
							<span className="text-sm sm:text-base font-extrabold text-white mt-0.5 block">
								{formatCurrency(summary.this_month)}
							</span>
						</div>
						<div>
							<span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
								Last Month
							</span>
							<span className="text-sm sm:text-base font-extrabold text-slate-300 mt-0.5 block">
								{formatCurrency(summary.last_month)}
							</span>
						</div>
						<div>
							<span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
								MoM Shift
							</span>
							<span
								className={`text-sm sm:text-base font-extrabold mt-0.5 flex items-center gap-1 ${
									growthPositive ? "text-emerald-400" : "text-slate-400"
								}`}
							>
								{growthPositive ? (
									<TrendingUp size={13} />
								) : (
									<TrendingDown size={13} />
								)}
								{summary.growth_pct !== null ? `${summary.growth_pct}%` : "—"}
							</span>
						</div>
					</div>
				</div>

				{/* Volume & Telemetry (5 Cols) */}
				<div className="lg:col-span-5 grid grid-cols-2 gap-4">
					<div className="p-5 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-lg flex flex-col justify-between">
						<span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
							Completed Jobs
						</span>
						<div className="mt-3">
							<span className="text-2xl sm:text-3xl font-black text-white">
								{summary.completed_jobs ?? 0}
							</span>
							<p className="text-[12.5px] text-slate-500 mt-1">
								Paid customer visits
							</p>
						</div>
					</div>

					<div className="p-5 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-lg flex flex-col justify-between">
						<span className="text-[12.5px] font-bold uppercase tracking-wider text-slate-400">
							Avg Ticket Value
						</span>
						<div className="mt-3">
							<span className="text-2xl sm:text-3xl font-black text-white">
								{formatCurrency(
									summary.completed_jobs > 0
										? Math.round(
												(summary.total_earnings || 0) / summary.completed_jobs,
											)
										: 499,
								)}
							</span>
							<p className="text-[12.5px] text-slate-500 mt-1">
								Gross job value
							</p>
						</div>
					</div>

					<div className="col-span-2 p-5 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-lg flex items-center justify-between">
						<div className="space-y-0.5">
							<span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
								Next Estimated Disbursement
							</span>
							<span className="text-sm font-bold text-white">
								Scheduled Every Monday • Direct NEFT/IMPS
							</span>
						</div>
						<div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/20">
							<CreditCard size={18} />
						</div>
					</div>
				</div>
			</div>

			{/* Chart & Activity Stream */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
				{/* Revenue History Chart (7 Cols) */}
				<div className="lg:col-span-7 p-6 sm:p-7 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-xl space-y-6">
					<div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
						<div>
							<h3 className="text-base font-extrabold text-white">
								Revenue Progression
							</h3>
							<p className="text-sm text-slate-400">
								Monthly billing volume over past quarters
							</p>
						</div>
						<span className="text-xs text-slate-400 font-mono">FY 2026</span>
					</div>

					<div className="h-64 pt-2">
						{monthlyData.length === 0 ? (
							<div className="h-full flex items-center justify-center text-xs text-slate-500">
								No historical monthly volume available
							</div>
						) : (
							<Bar data={chartData} options={chartOptions} />
						)}
					</div>
				</div>

				{/* Transactions Stream Ledger (5 Cols) */}
				<div className="lg:col-span-5 p-6 rounded-3xl bg-[#120a22] border border-white/[0.07] shadow-xl flex flex-col justify-between space-y-4">
					<div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
						<h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
							<Activity size={15} className="text-violet-400" />
							Recent Transactions
						</h3>
						<span className="text-[11px] text-slate-500 font-mono">
							Page {txPage} of {txMeta.total_pages || 1}
						</span>
					</div>

					<div className="flex-1">
						{txLoading ? (
							<div className="py-16 text-center text-xs text-slate-500">
								Loading records...
							</div>
						) : transactions.length === 0 ? (
							<div className="py-16 text-center text-slate-500 space-y-2">
								<FileText size={24} className="mx-auto text-slate-600" />
								<p className="text-xs">No transactions recorded yet</p>
							</div>
						) : (
							<div className="divide-y divide-white/[0.04]">
								{transactions.map((tx, idx) => {
									const isCredit = tx.type !== "deduction";
									const date = new Date(tx.date || tx.created_at);

									return (
										<div
											key={tx.id || idx}
											onClick={() => navigate("/provider/dashboard/bookings")}
											className="py-3 flex items-center justify-between gap-3 group cursor-pointer hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
										>
											<div className="flex items-center gap-3 min-w-0">
												<div
													className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
														isCredit
															? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
															: "bg-rose-500/10 text-rose-400 border-rose-500/20"
													}`}
												>
													{isCredit ? (
														<ArrowDownRight size={13} />
													) : (
														<ArrowUpRight size={13} />
													)}
												</div>
												<div className="min-w-0">
													<p className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors">
														{tx.description ||
															tx.service_name ||
															"Job Settlement"}
													</p>
													<span className="text-[12px] text-slate-500 font-mono">
														{isNaN(date)
															? "—"
															: date.toLocaleDateString("en-IN", {
																	month: "short",
																	day: "numeric",
																})}
														{tx.booking_id
															? ` · #${tx.booking_id.slice(0, 6)}`
															: ""}
													</span>
												</div>
											</div>

											<span
												className={`text-sm font-extrabold font-mono shrink-0 ${
													isCredit ? "text-emerald-400" : "text-rose-400"
												}`}
											>
												{isCredit ? "+" : "-"}
												{formatCurrency(Math.abs(tx.amount))}
											</span>
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Pagination Controls */}
					{txMeta.total_pages > 1 && (
						<div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
							<button
								disabled={txPage <= 1}
								onClick={() => setTxPage((p) => Math.max(1, p - 1))}
								className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
							>
								<ChevronLeft size={14} /> Previous
							</button>
							<button
								disabled={!txMeta.has_next_page}
								onClick={() => setTxPage((p) => p + 1)}
								className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
							>
								Next <ChevronRight size={14} />
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

const EarningsSkeleton = () => (
	<div className="space-y-8 animate-pulse">
		<div className="flex justify-between items-center pb-6 border-b border-white/[0.06]">
			<div className="space-y-2">
				<div className="h-8 bg-white/[0.05] rounded-xl w-64" />
				<div className="h-4 bg-white/[0.03] rounded-lg w-48" />
			</div>
			<div className="h-10 w-36 bg-white/[0.05] rounded-xl" />
		</div>
		<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
			<div className="lg:col-span-7 h-64 bg-white/[0.03] rounded-3xl border border-white/[0.05]" />
			<div className="lg:col-span-5 grid grid-cols-2 gap-4">
				{[...Array(4)].map((_, i) => (
					<div
						key={i}
						className="h-28 bg-white/[0.03] rounded-3xl border border-white/[0.05]"
					/>
				))}
			</div>
		</div>
	</div>
);

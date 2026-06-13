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
	BarChart2,
	ArrowUpRight,
	ArrowDownRight,
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
		minimumFractionDigits: 0,
	}).format(n || 0);

const ACCENT_MAP = {
	violet: {
		card: "bg-violet-500/10 border-violet-500/20",
		icon: "bg-violet-500/15 text-violet-300 border-violet-500/20",
		val: "text-violet-100",
	},
	emerald: {
		card: "bg-emerald-500/10 border-emerald-500/20",
		icon: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
		val: "text-emerald-100",
	},
	blue: {
		card: "bg-blue-500/10 border-blue-500/20",
		icon: "bg-blue-500/15 text-blue-300 border-blue-500/20",
		val: "text-blue-100",
	},
	amber: {
		card: "bg-amber-500/10 border-amber-500/20",
		icon: "bg-amber-500/15 text-amber-300 border-amber-500/20",
		val: "text-amber-100",
	},
};

const StatCard = ({ label, value, icon: Icon, accent, sub, delay }) => {
	const a = ACCENT_MAP[accent] || ACCENT_MAP.violet;
	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay }}
			className={`p-5 rounded-2xl border flex flex-col gap-3 ${a.card}`}
		>
			<div className="flex items-center justify-between">
				<span className="text-xs font-bold uppercase tracking-wider text-slate-500">
					{label}
				</span>
				<div
					className={`w-9 h-9 rounded-xl flex items-center justify-center border ${a.icon}`}
				>
					<Icon size={16} />
				</div>
			</div>
			<div>
				<p className={`text-2xl font-extrabold tracking-tight ${a.val}`}>
					{value}
				</p>
				{sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
			</div>
		</motion.div>
	);
};

const TxRow = ({ tx }) => {
	const isCredit = tx.type !== "deduction";
	const date = new Date(tx.date || tx.created_at);
	const navigate = useNavigate();

	return (
		<div
			onClick={() => navigate("/provider/dashboard/bookings")}
			className="cursor-pointer flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors group"
		>
			<div className="flex items-center gap-4">
				<div
					className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
						isCredit
							? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
							: "bg-red-500/10 text-red-400 border-red-500/20"
					}`}
				>
					{isCredit ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
				</div>
				<div>
					<p className="text-sm font-semibold text-white">
						{tx.description || tx.service_name || "Service Payment"}
					</p>
					<p className="text-xs text-slate-500 mt-0.5">
						{isNaN(date)
							? "—"
							: date.toLocaleDateString("en-IN", {
									day: "numeric",
									month: "short",
									year: "numeric",
								})}
						{tx.booking_id
							? ` · #${tx.booking_id.slice(0, 6).toUpperCase()}`
							: ""}
					</p>
				</div>
			</div>
			<span
				className={`text-sm font-bold tabular-nums ${isCredit ? "text-emerald-400" : "text-red-400"}`}
			>
				{isCredit ? "+" : "-"}
				{formatCurrency(Math.abs(tx.amount))}
			</span>
		</div>
	);
};

const EarningsSkeleton = () => (
	<div className="space-y-8 animate-pulse">
		<div className="h-10 bg-slate-800 rounded-2xl w-48" />
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
			{[...Array(4)].map((_, i) => (
				<div key={i} className="h-28 bg-slate-800/60 rounded-2xl" />
			))}
		</div>
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<div className="lg:col-span-2 h-64 bg-slate-800/60 rounded-3xl" />
			<div className="h-64 bg-slate-800/60 rounded-3xl" />
		</div>
		<div className="h-64 bg-slate-800/60 rounded-3xl" />
	</div>
);

export default function ProviderEarnings() {
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
					`/api/earnings/provider/transactions?page=${txPage}&limit=8`,
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
	const chartData = {
		labels: monthlyData.map((m) => m.label),
		datasets: [
			{
				label: "Revenue",
				data: monthlyData.map((m) => m.amount),
				backgroundColor: "rgba(139, 92, 246, 0.25)",
				borderColor: "rgba(167, 139, 250, 1)",
				borderWidth: 2,
				borderRadius: 6,
				hoverBackgroundColor: "rgba(139, 92, 246, 0.5)",
			},
		],
	};

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false },
			tooltip: {
				backgroundColor: "#1e293b",
				titleFont: { family: "Inter", size: 12 },
				bodyFont: { family: "Inter", size: 13, weight: "bold" },
				padding: 10,
				borderColor: "rgba(255,255,255,0.08)",
				borderWidth: 1,
				callbacks: {
					label: function (context) {
						return ` ${formatCurrency(context.raw)}`;
					},
				},
			},
		},
		scales: {
			x: {
				// grid: { color: "rgba(255, 255, 255, 0.04)" },
				grid: { display: false },
				ticks: {
					color: "#94a3b8",
					font: { family: "Inter", size: 12 },
				},
			},
			y: {
				grid: { color: "rgba(255, 255, 255, 0.04)" },
				ticks: {
					color: "#94a3b8",
					font: { family: "Inter", size: 12 },
					callback: (value) => "₹" + value,
				},
			},
		},
	};

	if (isLoading) return <EarningsSkeleton />;

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="space-y-8"
		>
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<h1 className="text-3xl font-bold text-white tracking-tight">
						Earnings
					</h1>
					<p className="text-slate-400 mt-1 text-sm">
						Your income breakdown and transaction history.
					</p>
				</div>
				<button className="hidden sm:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-medium border border-white/10 text-sm transition-all active:scale-95">
					<Download size={15} />
					Export Report
				</button>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					label="Total Earnings"
					value={formatCurrency(summary.total_earnings)}
					icon={IndianRupee}
					accent="violet"
					delay={0}
					sub="All time"
				/>
				<StatCard
					label="This Month"
					value={formatCurrency(summary.this_month)}
					icon={TrendingUp}
					accent="emerald"
					delay={0.05}
					sub={
						summary.growth_pct != null
							? `${growthPositive ? "+" : ""}${summary.growth_pct}% vs last month`
							: undefined
					}
				/>
				<StatCard
					label="Pending Payout"
					value={formatCurrency(summary.pending_payout)}
					icon={Clock}
					accent="amber"
					delay={0.1}
					sub="Processing"
				/>
				<StatCard
					label="Jobs Completed"
					value={summary.completed_jobs ?? 0}
					icon={CheckCircle2}
					accent="blue"
					delay={0.15}
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					className="lg:col-span-2 bg-slate-900/60 border border-white/8 rounded-3xl p-6"
				>
					<div className="flex items-center justify-between mb-6">
						<h3 className="font-bold text-white flex items-center gap-2">
							<div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
								<BarChart2 size={16} />
							</div>
							Monthly Earnings
						</h3>
						<span className="text-xs text-slate-500">
							Last {monthlyData.length || 6} months
						</span>
					</div>
					<div className="h-44 w-full flex-1 min-h-[180px]">
						{monthlyData.length > 0 ? (
							<Bar data={chartData} options={chartOptions} />
						) : (
							<div className="h-full flex items-center justify-center text-slate-600 text-sm">
								No monthly data yet
							</div>
						)}
					</div>
				</motion.div>

				{/* Month comparison card */}
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.25 }}
					className="bg-slate-900/60 border border-white/8 rounded-3xl p-6 flex flex-col justify-between"
				>
					<h3 className="font-bold text-white flex items-center gap-2 mb-6">
						<div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
							<Calendar size={16} />
						</div>
						Month Comparison
					</h3>
					<div className="space-y-4 flex-1">
						{[
							{
								label: "This Month",
								value: summary.this_month,
								accent: "text-emerald-400",
							},
							{
								label: "Last Month",
								value: summary.last_month,
								accent: "text-slate-400",
							},
						].map(({ label, value, accent }) => (
							<div
								key={label}
								className="flex justify-between items-center p-3 rounded-xl bg-slate-800/40 border border-white/6"
							>
								<span className="text-sm text-slate-400">{label}</span>
								<span className={`text-sm font-bold tabular-nums ${accent}`}>
									{formatCurrency(value)}
								</span>
							</div>
						))}
						<div
							className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold ${
								growthPositive
									? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
									: "bg-red-500/10 border-red-500/20 text-red-300"
							}`}
						>
							{growthPositive ? (
								<TrendingUp size={16} />
							) : (
								<TrendingDown size={16} />
							)}
							{summary.growth_pct != null
								? `${growthPositive ? "+" : ""}${summary.growth_pct}% growth`
								: "No comparison data"}
						</div>
					</div>
				</motion.div>
			</div>

			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.3 }}
				className="bg-slate-900/60 border border-white/8 rounded-3xl overflow-hidden"
			>
				<div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
					<h3 className="font-bold text-white flex items-center gap-2">
						<div className="p-2 bg-slate-800 rounded-lg text-slate-400">
							<IndianRupee size={16} />
						</div>
						Transaction History
					</h3>
				</div>

				{txLoading ? (
					<div className="flex items-center justify-center h-40 text-slate-500">
						<div className="w-6 h-6 border-2 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
					</div>
				) : transactions.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-40 text-slate-600">
						<IndianRupee size={24} className="mb-2 opacity-30" />
						<p className="text-sm font-medium text-slate-400">
							No transactions yet
						</p>
					</div>
				) : (
					<div className="divide-y divide-white/5">
						{transactions.map((tx, i) => (
							<TxRow key={tx.id || i} tx={tx} />
						))}
					</div>
				)}

				{/* Pagination */}
				<div className="p-4 border-t border-white/6 bg-slate-950/30 flex justify-between items-center">
					<span className="text-xs text-slate-500">
						Page {txPage} of {txMeta.total_pages || 1}
					</span>
					<div className="flex gap-2">
						<button
							onClick={() => setTxPage((p) => Math.max(1, p - 1))}
							disabled={txPage === 1 || txLoading}
							className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 border border-white/8 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
						>
							Previous
						</button>
						<button
							onClick={() => setTxPage((p) => p + 1)}
							disabled={!txMeta.has_next_page || txLoading}
							className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 border border-white/8 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
						>
							Next
						</button>
					</div>
				</div>
			</motion.div>
		</motion.div>
	);
}

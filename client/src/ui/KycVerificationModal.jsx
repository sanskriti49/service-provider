import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
	Shield,
	ShieldCheck,
	AlertTriangle,
	Clock,
	UploadCloud,
	FileCheck,
	CheckCircle2,
	X,
	ExternalLink,
	Lock,
	Sparkles,
	RefreshCw,
	Info,
	Check,
} from "lucide-react";
import { FadeLoader } from "react-spinners";
import api from "../api/axiosInstance";
import { useAuth } from "../contexts/AuthContext";
import VerifiedBadge from "./VerifiedBadge";

const DOC_TYPES = [
	{
		id: "aadhaar",
		label: "Aadhaar Card",
		sub: "UIDAI 12-Digit ID (Masked Accepted)",
		icon: "🇮🇳",
		placeholder: "e.g. 5482 1920 4412 or XXXX XXXX 4412",
		backRequired: true,
	},
	{
		id: "driving_license",
		label: "Driving License",
		sub: "State Transport Dept",
		icon: "🪪",
		placeholder: "e.g. MH-02-2018-0091242",
		backRequired: true,
	},
	{
		id: "certificate",
		label: "Trade Certificate",
		sub: "Certified Professional",
		icon: "📜",
		placeholder: "e.g. CERT-PLUMB-90211",
		backRequired: false,
	},
	{
		id: "pan",
		label: "PAN Card",
		sub: "Income Tax Dept",
		icon: "💳",
		placeholder: "e.g. ABCDE1234F",
		backRequired: false,
	},
];

export default function KycVerificationModal({ isOpen, onClose, onKycUpdated }) {
	const { user, syncUser } = useAuth();

	const [loading, setLoading] = useState(false);
	const [fetchingKyc, setFetchingKyc] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [successMsg, setSuccessMsg] = useState("");
	const [isReuploading, setIsReuploading] = useState(false);

	// KYC Form Data
	const [docType, setDocType] = useState("aadhaar");
	const [docNumber, setDocNumber] = useState("");
	const [docFront, setDocFront] = useState("");
	const [docBack, setDocBack] = useState("");
	const [declaration, setDeclaration] = useState(false);
	const [uploadingSide, setUploadingSide] = useState({ front: false, back: false });

	const [kycData, setKycData] = useState(null);

	const frontInputRef = useRef(null);
	const backInputRef = useRef(null);
	const submitButtonRef = useRef(null);

	// Lock body scroll while modal is active
	useEffect(() => {
		if (isOpen) {
			const prevOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = prevOverflow;
			};
		}
	}, [isOpen]);

	// Keyboard Shortcuts: Esc to close, Ctrl+Enter to submit
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			} else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				if (submitButtonRef.current) {
					e.preventDefault();
					submitButtonRef.current.click();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	// Fetch current provider KYC status whenever modal opens
	useEffect(() => {
		if (isOpen && user?.id) {
			setErrorMsg("");
			setSuccessMsg("");
			setIsReuploading(false);
			fetchStatus();
		}
	}, [isOpen, user?.id]);

	const fetchStatus = async () => {
		if (!user?.id) return;
		setFetchingKyc(true);
		try {
			const res = await api.get(`/api/providers/v1/${user.id}/kyc`);
			if (res.data?.kyc) {
				const k = res.data.kyc;
				setKycData(k);
				if (k.kyc_doc_type) setDocType(k.kyc_doc_type);
				if (k.kyc_doc_number) setDocNumber(k.kyc_doc_number);
				if (k.kyc_doc_front) setDocFront(k.kyc_doc_front);
				if (k.kyc_doc_back) setDocBack(k.kyc_doc_back || "");
			}
		} catch (err) {
			console.warn("Could not fetch KYC status details:", err.message);
			if (user) {
				setKycData({
					kyc_status: user.kyc_status || "pending",
					is_verified: user.is_verified || false,
					verification_badge: user.verification_badge,
					kyc_doc_type: user.kyc_doc_type,
					kyc_doc_number: user.kyc_doc_number,
					kyc_doc_front: user.kyc_doc_front,
					kyc_doc_back: user.kyc_doc_back,
					rejection_reason: user.rejection_reason,
					verified_at: user.verified_at,
					kyc_submitted_at: user.kyc_submitted_at,
				});
			}
		} finally {
			setFetchingKyc(false);
		}
	};

	const handleFileUpload = async (e, side) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			setErrorMsg("Document photo must be under 5MB.");
			return;
		}

		setUploadingSide((prev) => ({ ...prev, [side]: true }));
		setErrorMsg("");

		const formData = new FormData();
		formData.append("document", file);

		try {
			const res = await api.post("/api/providers/upload-kyc", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			if (res.data?.url) {
				if (side === "front") setDocFront(res.data.url);
				else setDocBack(res.data.url);
			}
		} catch (err) {
			console.error("KYC doc upload error:", err);
			setErrorMsg(err.response?.data?.error || "Failed to upload document. Please try a different photo.");
		} finally {
			setUploadingSide((prev) => ({ ...prev, [side]: false }));
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setErrorMsg("");
		setSuccessMsg("");

		if (!docType) {
			setErrorMsg("Please select an official identification document type.");
			return;
		}
		if (!docNumber || docNumber.trim().length < 4) {
			setErrorMsg("Please enter your valid document identification number.");
			return;
		}
		if (!docFront) {
			setErrorMsg("Please upload a clear front photo of your identification card.");
			return;
		}
		const selectedDoc = DOC_TYPES.find((d) => d.id === docType);
		if (selectedDoc?.backRequired && !docBack) {
			setErrorMsg(`Please upload the reverse (back) side of your ${selectedDoc.label}.`);
			return;
		}
		if (!declaration) {
			setErrorMsg("You must confirm the legal accuracy declaration before submitting.");
			return;
		}

		setLoading(true);
		try {
			const payload = {
				kyc_doc_type: docType,
				kyc_doc_number: docNumber.trim(),
				kyc_doc_front: docFront,
				kyc_doc_back: docBack || null,
				kyc_declaration: true,
			};

			const res = await api.put(`/api/providers/v1/${user.id}/kyc`, payload);
			setSuccessMsg(res.data?.message || "KYC documents submitted successfully for administrative review.");

			const updatedKyc = res.data?.kyc || {
				kyc_status: "pending",
				is_verified: false,
				kyc_doc_type: docType,
				kyc_doc_number: docNumber,
				kyc_doc_front: docFront,
				kyc_doc_back: docBack,
			};
			setKycData(updatedKyc);
			syncUser({ ...updatedKyc });
			setIsReuploading(false);

			if (onKycUpdated) onKycUpdated(updatedKyc);
		} catch (err) {
			console.error("KYC submission error:", err);
			setErrorMsg(err.response?.data?.error || "Submission failed. Please check the fields and try again.");
		} finally {
			setLoading(false);
		}
	};

	const isVerified = Boolean(kycData?.is_verified || kycData?.kyc_status === "verified");
	const isPending = Boolean(!isVerified && kycData?.kyc_status === "pending" && !isReuploading);
	const isRejected = Boolean(!isVerified && kycData?.kyc_status === "rejected" && !isReuploading);
	const showForm = !isVerified && (!isPending || isReuploading);

	const maskNumber = (num) => {
		if (!num) return "";
		if (num.length <= 4) return num;
		return "•••• •••• " + num.slice(-4);
	};

	if (!isOpen) return null;

	const modalContent = (
		<AnimatePresence>
			<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
				{/* Backdrop */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
					className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
				/>

				{/* Modal Dialog Card */}
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 15 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 15 }}
					transition={{ duration: 0.2, ease: "easeOut" }}
					className="relative w-full max-w-2xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto z-10"
				>
					{/* Modal Header */}
					<div className="relative px-6 sm:px-8 pt-7 pb-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-b from-slate-50/80 to-white">
						<div className="space-y-1">
							<div className="flex items-center gap-2.5">
								<div className="p-2 rounded-xl bg-violet-100 text-violet-700">
									<Shield className="w-5 h-5" />
								</div>
								<h2 className="font-mackinac text-2xl font-black text-slate-900 tracking-tight">
									Provider KYC Verification
								</h2>
							</div>
							<p className="bricolage-grotesque text-xs sm:text-sm text-slate-500">
								Government identity vetting to unlock client bookings and the Gold Verified Pro badge.
							</p>
						</div>

						<button
							onClick={onClose}
							className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
							title="Close (Esc)"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* Modal Body */}
					<div className="px-6 sm:px-8 py-6 max-h-[70vh] overflow-y-auto space-y-6">
						{/* Alerts */}
						{errorMsg && (
							<motion.div
								initial={{ opacity: 0, y: -5 }}
								animate={{ opacity: 1, y: 0 }}
								className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3"
							>
								<AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
								<div className="space-y-0.5">
									<span className="font-bold block">Verification Notice</span>
									<p>{errorMsg}</p>
								</div>
							</motion.div>
						)}

						{successMsg && (
							<motion.div
								initial={{ opacity: 0, y: -5 }}
								animate={{ opacity: 1, y: 0 }}
								className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-3"
							>
								<CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
								<div className="space-y-0.5">
									<span className="font-bold block">Success!</span>
									<p>{successMsg}</p>
								</div>
							</motion.div>
						)}

						{/* 1. STATE: VERIFIED */}
						{isVerified && (
							<div className="space-y-6 py-2">
								<div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-200/80 text-center space-y-4">
									<div className="inline-flex p-3 rounded-2xl bg-emerald-100 text-emerald-700 shadow-inner">
										<ShieldCheck className="w-10 h-10" />
									</div>
									<div className="space-y-1">
										<div className="flex items-center justify-center gap-2">
											<h3 className="font-mackinac text-2xl font-bold text-slate-900">
												Identity Verified & Approved!
											</h3>
											<VerifiedBadge size="lg" />
										</div>
										<p className="bricolage-grotesque text-sm text-slate-600 max-w-md mx-auto">
											Your government documentation has been inspected and approved. Your profile now ranks with priority in customer searches.
										</p>
									</div>

									{/* Verified Highlights */}
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
										<div className="p-3.5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
											<span className="text-[10px] uppercase font-bold text-slate-400 block">
												Document Type
											</span>
											<span className="font-semibold text-slate-800 text-xs capitalize mt-0.5 block">
												{kycData?.kyc_doc_type ? kycData.kyc_doc_type.replace("_", " ") : "Government ID"}
											</span>
										</div>
										<div className="p-3.5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
											<span className="text-[10px] uppercase font-bold text-slate-400 block">
												Doc Number
											</span>
											<span className="font-mono text-xs text-slate-800 font-bold mt-0.5 block">
												{maskNumber(kycData?.kyc_doc_number)}
											</span>
										</div>
										<div className="p-3.5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
											<span className="text-[10px] uppercase font-bold text-slate-400 block">
												Status Badge
											</span>
											<span className="font-bold text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
												<Sparkles className="w-3.5 h-3.5" /> Gold Verified Pro
											</span>
										</div>
									</div>
								</div>

								<div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500 flex items-center justify-between">
									<span className="flex items-center gap-2">
										<Lock className="w-4 h-4 text-slate-400" />
										Protected by 256-bit AES identity storage
									</span>
									<button
										onClick={() => setIsReuploading(true)}
										className="text-xs font-bold text-violet-600 hover:text-violet-700 hover:underline cursor-pointer"
									>
										Update document
									</button>
								</div>
							</div>
						)}

						{/* 2. STATE: PENDING REVIEW */}
						{isPending && (
							<div className="space-y-6 py-2">
								<div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-200/80 space-y-4">
									<div className="flex items-start gap-4">
										<div className="p-3 rounded-2xl bg-amber-100 text-amber-700 shrink-0">
											<Clock className="w-7 h-7" />
										</div>
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<h3 className="font-mackinac text-xl font-bold text-slate-900">
													Documents Under Review
												</h3>
												<span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-200 text-amber-900 uppercase">
													In Review
												</span>
											</div>
											<p className="bricolage-grotesque text-xs sm:text-sm text-slate-600 leading-relaxed">
												Our compliance and security officers verify identification cards to protect homeowners and prevent fraud.
											</p>
										</div>
									</div>

									{/* Review SLA Timeline */}
									<div className="pt-3 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div className="p-3 rounded-xl bg-white/80 border border-amber-100">
											<span className="text-[10px] font-bold uppercase text-slate-400 block">
												Review SLA Window
											</span>
											<span className="text-xs font-bold text-slate-800 mt-0.5 block">
												24 – 48 Business Hours
											</span>
										</div>
										<div className="p-3 rounded-xl bg-white/80 border border-amber-100">
											<span className="text-[10px] font-bold uppercase text-slate-400 block">
												Submitted Document
											</span>
											<span className="text-xs font-bold text-slate-800 mt-0.5 block capitalize">
												{kycData?.kyc_doc_type?.replace("_", " ") || "Government ID"} ({maskNumber(kycData?.kyc_doc_number)})
											</span>
										</div>
									</div>
								</div>

								{/* Attached Document Preview */}
								<div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
									<h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
										Submitted Verification Attachments
									</h4>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{kycData?.kyc_doc_front && (
											<a
												href={kycData.kyc_doc_front}
												target="_blank"
												rel="noreferrer"
												className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700 transition-colors"
											>
												<span className="flex items-center gap-2">
													<FileCheck className="w-4 h-4 text-emerald-600" />
													Front Side Photo
												</span>
												<ExternalLink className="w-3.5 h-3.5 text-slate-400" />
											</a>
										)}
										{kycData?.kyc_doc_back && (
											<a
												href={kycData.kyc_doc_back}
												target="_blank"
												rel="noreferrer"
												className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700 transition-colors"
											>
												<span className="flex items-center gap-2">
													<FileCheck className="w-4 h-4 text-emerald-600" />
													Back Side Photo
												</span>
												<ExternalLink className="w-3.5 h-3.5 text-slate-400" />
											</a>
										)}
									</div>

									<div className="pt-2 flex justify-end">
										<button
											type="button"
											onClick={() => setIsReuploading(true)}
											className="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 hover:underline cursor-pointer"
										>
											<RefreshCw className="w-3.5 h-3.5" /> Re-upload or update documents
										</button>
									</div>
								</div>
							</div>
						)}

						{/* 3. STATE: REJECTED */}
						{isRejected && (
							<div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-200/80 space-y-4">
								<div className="flex items-start gap-4">
									<div className="p-3 rounded-2xl bg-rose-100 text-rose-700 shrink-0">
										<AlertTriangle className="w-7 h-7" />
									</div>
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<h3 className="font-mackinac text-xl font-bold text-slate-900">
												Verification Unsuccessful
											</h3>
											<span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-200 text-rose-900 uppercase">
												Action Needed
											</span>
										</div>
										<p className="bricolage-grotesque text-xs sm:text-sm text-slate-700">
											{kycData?.rejection_reason ||
												"The submitted document could not be validated. Common issues include blurry images, corner cutoffs, or name mismatch."}
										</p>
									</div>
								</div>

								<div className="pt-2">
									<button
										type="button"
										onClick={() => setIsReuploading(true)}
										className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md active:scale-98 cursor-pointer"
									>
										Upload Fresh & Clear Documents
									</button>
								</div>
							</div>
						)}

						{/* 4. SUBMISSION FORM */}
						{showForm && (
							<form onSubmit={handleSubmit} className="space-y-5">
								{/* Sensitive Document Safety & UIDAI Masked Aadhaar Banner */}
								<div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-200/80 space-y-2">
									<div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
										<ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
										<span>Privacy First: Is It Safe to Upload Your Identification?</span>
									</div>
									<ul className="text-xs text-slate-600 space-y-1 pl-5 list-disc leading-relaxed">
										<li>
											<strong>Masked Aadhaar Recommended:</strong> Per UIDAI circulars, you may upload a <em>Masked Aadhaar</em> (first 8 digits hidden, showing only the last 4).
										</li>
										<li>
											<strong>Strictly Confidential:</strong> Your document is encrypted via TLS 1.3/AES-256 and stored in private vaults. It is <strong>NEVER shown to customers or homeowners</strong>.
										</li>
										<li>
											<strong>Alternative IDs:</strong> Prefer not to upload Aadhaar? You are welcome to select <strong>Driving License</strong>, <strong>Trade Certificate</strong>, or <strong>PAN Card</strong> instead.
										</li>
									</ul>
								</div>

								{isReuploading && (
									<div className="p-3 rounded-xl bg-violet-50 text-violet-800 text-xs flex items-center justify-between">
										<span>Updating your KYC submission details</span>
										<button
											type="button"
											onClick={() => setIsReuploading(false)}
											className="font-bold text-violet-700 hover:underline cursor-pointer"
										>
											Cancel
										</button>
									</div>
								)}

								{/* Document Type Grid */}
								<div>
									<label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
										1. Select Government Identification *
									</label>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										{DOC_TYPES.map((d) => (
											<button
												key={d.id}
												type="button"
												onClick={() => setDocType(d.id)}
												className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
													docType === d.id
														? "bg-violet-50/90 border-violet-500 ring-1 ring-violet-500/50 shadow-xs"
														: "bg-slate-50/60 border-slate-200 hover:border-violet-200 hover:bg-white"
												}`}
											>
												<div className="flex items-center gap-2.5">
													<span className="text-2xl">{d.icon}</span>
													<div>
														<span className="font-bold text-xs text-slate-800 block">
															{d.label}
														</span>
														<span className="text-[10px] text-slate-500 block">
															{d.sub}
														</span>
													</div>
												</div>
											</button>
										))}
									</div>
								</div>

								{/* Document Number Input */}
								<div>
									<label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
										2. {DOC_TYPES.find((d) => d.id === docType)?.label} Number *
									</label>
									<input
										type="text"
										value={docNumber}
										onChange={(e) => setDocNumber(e.target.value)}
										placeholder={DOC_TYPES.find((d) => d.id === docType)?.placeholder}
										className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono tracking-wide text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
										required
									/>
									<span className="text-[11px] text-slate-400 mt-1 block">
										{docType === "aadhaar"
											? "You may enter either your full 12 digits or masked format (e.g. XXXX XXXX 4412)."
											: "Must match the identification number printed on your official document."}
									</span>
								</div>

								{/* Front & Back Photo Dropzones */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
									{/* Front Photo */}
									<div className="space-y-1.5">
										<div className="flex items-center justify-between">
											<label className="text-xs font-bold text-slate-700">
												3. Document Front Photo *
											</label>
											{docFront && (
												<span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
													<FileCheck className="w-3.5 h-3.5" /> Attached
												</span>
											)}
										</div>

										<input
											type="file"
											ref={frontInputRef}
											onChange={(e) => handleFileUpload(e, "front")}
											accept="image/*,.pdf"
											className="hidden"
										/>

										{docFront ? (
											<div className="relative rounded-2xl border border-emerald-200 overflow-hidden bg-slate-50 aspect-[4/3] flex items-center justify-center shadow-inner group">
												<img
													src={docFront}
													alt="Front ID"
													className="w-full h-full object-cover"
												/>
												<div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
													<button
														type="button"
														onClick={() => frontInputRef.current?.click()}
														className="px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-colors"
													>
														Change
													</button>
												</div>
											</div>
										) : (
											<div
												onClick={() => frontInputRef.current?.click()}
												className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-violet-400 p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all aspect-[4/3] bg-slate-50/50 hover:bg-violet-50/30"
											>
												{uploadingSide.front ? (
													<div className="flex flex-col items-center gap-3">
														<FadeLoader color="#8b5cf6" height={8} width={2.5} radius={1} margin={-2} />
														<span className="text-xs text-slate-500 font-medium mt-1">Uploading...</span>
													</div>
												) : (
													<>
														<UploadCloud className="w-7 h-7 text-slate-400 mb-2" />
														<span className="text-xs font-bold text-slate-700 block">
															Upload Front Side
														</span>
														<span className="text-[10px] text-slate-400 mt-0.5">
															Clear photo or scan (PNG, JPG, PDF)
														</span>
													</>
												)}
											</div>
										)}
									</div>

									{/* Back Photo */}
									<div className="space-y-1.5">
										<div className="flex items-center justify-between">
											<label className="text-xs font-bold text-slate-700">
												4. Reverse Side {DOC_TYPES.find((d) => d.id === docType)?.backRequired ? "*" : "(Optional)"}
											</label>
											{docBack && (
												<span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
													<FileCheck className="w-3.5 h-3.5" /> Attached
												</span>
											)}
										</div>

										<input
											type="file"
											ref={backInputRef}
											onChange={(e) => handleFileUpload(e, "back")}
											accept="image/*,.pdf"
											className="hidden"
										/>

										{docBack ? (
											<div className="relative rounded-2xl border border-emerald-200 overflow-hidden bg-slate-50 aspect-[4/3] flex items-center justify-center shadow-inner group">
												<img
													src={docBack}
													alt="Back ID"
													className="w-full h-full object-cover"
												/>
												<div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
													<button
														type="button"
														onClick={() => backInputRef.current?.click()}
														className="px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-colors"
													>
														Change
													</button>
												</div>
											</div>
										) : (
											<div
												onClick={() => backInputRef.current?.click()}
												className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-violet-400 p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all aspect-[4/3] bg-slate-50/50 hover:bg-violet-50/30"
											>
												{uploadingSide.back ? (
													<div className="flex flex-col items-center gap-3">
														<FadeLoader color="#8b5cf6" height={8} width={2.5} radius={1} margin={-2} />
														<span className="text-xs text-slate-500 font-medium mt-1">Uploading...</span>
													</div>
												) : (
													<>
														<UploadCloud className="w-7 h-7 text-slate-400 mb-2" />
														<span className="text-xs font-bold text-slate-700 block">
															Upload Back Side
														</span>
														<span className="text-[10px] text-slate-400 mt-0.5">
															Required for Aadhaar &amp; DL
														</span>
													</>
												)}
											</div>
										)}
									</div>
								</div>

								{/* Legal Consent & Declaration Checkbox */}
								<div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
									<input
										type="checkbox"
										id="kycDeclaration"
										checked={declaration}
										onChange={(e) => setDeclaration(e.target.checked)}
										className="w-4 h-4 mt-0.5 accent-violet-600 rounded cursor-pointer shrink-0"
										required
									/>
									<label
										htmlFor="kycDeclaration"
										className="text-xs text-slate-600 leading-relaxed cursor-pointer"
									>
										I declare that the document provided is genuine and belongs to me. I authorize TaskGenie's compliance team to verify these credentials solely for platform authentication.
									</label>
								</div>

								{/* Action Buttons */}
								<div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
									<div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
										<span>Press</span>
										<kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600 font-semibold">
											Esc
										</kbd>
										<span>to close •</span>
										<kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600 font-semibold">
											Ctrl+Enter
										</kbd>
										<span>to submit</span>
									</div>

									<div className="flex items-center gap-2 ml-auto">
										<button
											type="button"
											onClick={onClose}
											className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
										>
											Cancel
										</button>
										<button
											type="submit"
											ref={submitButtonRef}
											disabled={loading || uploadingSide.front || uploadingSide.back}
											className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-violet-900/20 transition-all flex items-center gap-2 cursor-pointer"
										>
											{loading ? (
												<>
													<span className="inline-flex items-center justify-center w-4 h-4 scale-[0.35] origin-center -mx-1">
														<FadeLoader color="#ffffff" />
													</span>
													Submitting...
												</>
											) : (
												<>
													<ShieldCheck className="w-4 h-4" />
													Submit Verification
												</>
											)}
										</button>
									</div>
								</div>
							</form>
						)}
					</div>

					{/* Modal Footer Note */}
					<div className="px-6 sm:px-8 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
						<span className="flex items-center gap-1.5">
							<Lock className="w-3.5 h-3.5 text-slate-400" />
							256-bit encrypted. Confidential &amp; protected.
						</span>
						<span>SLA: 24–48 Business Hours</span>
					</div>
				</motion.div>
			</div>
		</AnimatePresence>
	);

	return createPortal(modalContent, document.body);
}

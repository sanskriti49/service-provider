import { useRef, useState, useEffect } from "react";
import emailjs from "@emailjs/browser";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import ServiceIllustration from "../ui/ServiceIllustration";
import {
	Mail,
	User,
	MessageSquare,
	Send,
	MessageCircleQuestionMark,
	ArrowRight,
	LifeBuoy,
	Bug,
	Lightbulb,
	Heart,
	Ellipsis,
	Check,
	CircleAlert,
	LoaderCircle,
} from "lucide-react";

/* EmailJS public keys are safe to ship, but env vars make them easier to rotate:
   import.meta.env.VITE_EMAILJS_* (Vite) */
const SERVICE_ID = "service_umuz4f3";
const TEMPLATE_ADMIN = "template_tsbhnim";
const TEMPLATE_USER = "template_44pf72s";
const PUBLIC_KEY = "VSuB8cLKQ6u5BQFuj";

const MAX_MESSAGE = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const topics = [
	{ value: "support", label: "I need help", icon: LifeBuoy },
	{ value: "bug", label: "I found a bug", icon: Bug },
	{ value: "feature", label: "Feature request", icon: Lightbulb },
	{ value: "love", label: "Just some love", icon: Heart },
	{ value: "other", label: "Something else", icon: Ellipsis },
];

const replyMessages = {
	support:
		"We have received your support ticket. Our team is currently reviewing it and will get back to you within 24 hours.",
	bug: "Thank you so much for the heads up! We've logged this bug with our engineering team. We appreciate you helping us make the app better.",
	feature:
		"That sounds like a great idea! I've passed your suggestion directly to our product team for our next roadmap review.",
	love: "Wow, you just made our day! We shared your message with the whole team. Thank you for being an awesome part of our community.",
	other:
		"We have received your message and routed it to the appropriate team member. We'll be in touch shortly.",
	default: "Thanks for reaching out! We'll get back to you shortly.",
};

const trustPoints = [
	"Verified & trained professionals",
	"Fast, same-day bookings",
	"Transparent pricing, no hidden fees",
	"Safe home service experience",
	"24×7 support & hassle-free rebooking",
];

const emptyForm = { subject: "", user_name: "", user_email: "", message: "" };

const validate = (v) => {
	const e = {};
	if (!v.subject) e.subject = "Pick what this is about so we can route it.";
	if (!v.user_name.trim()) e.user_name = "Please tell us your name.";
	if (!v.user_email.trim()) e.user_email = "We need your email to reply.";
	else if (!EMAIL_RE.test(v.user_email.trim()))
		e.user_email = "That email doesn't look right. Check for typos.";
	if (v.message.trim().length < 10)
		e.message = "Add a few more details (at least 10 characters).";
	return e;
};

const inputCls = (hasError) =>
	`w-full rounded-xl bg-white/80 border pl-10 pr-4 py-3.5 text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:ring-4 ${
		hasError
			? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
			: "border-slate-200 focus:border-violet-400 focus:ring-violet-100"
	}`;

const Field = ({ id, label, icon: Icon, error, hint, multiline, children }) => (
	<div>
		<label
			htmlFor={id}
			className="mb-1.5 block text-sm font-semibold text-slate-700"
		>
			{label}
		</label>
		<div className="relative group">
			<Icon
				aria-hidden="true"
				className={`pointer-events-none absolute left-3 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-violet-500 ${
					multiline ? "top-4" : "top-1/2 -translate-y-1/2"
				}`}
			/>
			{children}
		</div>
		<div className="mt-1.5 flex min-h-[1.25rem] items-start justify-between gap-3 text-xs">
			{error ? (
				<p
					id={`${id}-error`}
					role="alert"
					className="flex items-center gap-1 font-medium text-rose-600"
				>
					<CircleAlert className="h-3.5 w-3.5 shrink-0" />
					{error}
				</p>
			) : (
				<span />
			)}
			{hint}
		</div>
	</div>
);

export default function ContactSection() {
	const reduce = useReducedMotion();
	const formRef = useRef(null);
	const [form, setForm] = useState(emptyForm);
	const [touched, setTouched] = useState({});
	const [loading, setLoading] = useState(false);
	const [sentReply, setSentReply] = useState(null);

	useEffect(() => {
		emailjs.init(PUBLIC_KEY);
	}, []);

	const errors = validate(form);
	const showError = (k) => (touched[k] ? errors[k] : undefined);
	const currentReply = replyMessages[form.subject] || replyMessages.default;

	const handleChange = (e) => {
		const { name, value } = e.target;
		setForm((f) => ({ ...f, [name]: value }));
	};
	const handleBlur = (e) =>
		setTouched((t) => ({ ...t, [e.target.name]: true }));

	const pickTopic = (value) => {
		setForm((f) => ({ ...f, subject: value }));
		setTouched((t) => ({ ...t, subject: true }));
	};

	const sendEmail = (e) => {
		e.preventDefault();
		if (loading) return;

		setTouched({
			subject: true,
			user_name: true,
			user_email: true,
			message: true,
		});
		const firstInvalid = ["subject", "user_name", "user_email", "message"].find(
			(k) => errors[k],
		);
		if (firstInvalid) {
			const el =
				firstInvalid === "subject"
					? formRef.current.querySelector('[role="radio"]')
					: formRef.current.elements.namedItem(firstInvalid);
			el?.focus();
			return;
		}

		setLoading(true);
		const replyForUser = currentReply;

		const request = emailjs
			.sendForm(SERVICE_ID, TEMPLATE_ADMIN, formRef.current, {
				publicKey: PUBLIC_KEY,
			})
			.then(() =>
				emailjs.send(SERVICE_ID, TEMPLATE_USER, {
					// Fixed: these previously read form.user_name / form.user_email,
					// which were never in state, so the confirmation email got undefined.
					user_name: form.user_name,
					user_email: form.user_email,
					dynamic_message: replyForUser,
				}),
			);

		toast.promise(request, {
			loading: "Sending your message...",
			success: "Message sent successfully!",
			error: "Failed to send message. Please try again.",
			className:
				"bricolage-grotesque rounded-2xl p-4 shadow-xl border border-white/40 bg-white/90 backdrop-blur-md text-base font-semibold text-slate-800",
		});

		request
			.then(() => {
				setSentReply(replyForUser);
				setForm(emptyForm);
				setTouched({});
			})
			.catch((err) => console.error("FAILED...", err))
			.finally(() => setLoading(false));
	};

	const fade = reduce
		? {}
		: {
				initial: { opacity: 0, y: 16 },
				animate: { opacity: 1, y: 0 },
				transition: { duration: 0.5 },
			};

	return (
		<div className="bricolage-grotesque relative min-h-screen w-full overflow-hidden bg-[#F3F4F6] px-5 py-16 sm:px-8 sm:py-24">
			<div className="pointer-events-none absolute top-0 left-0 h-96 w-96 rounded-full bg-purple-300 opacity-30 mix-blend-multiply blur-3xl animate-blob" />
			<div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-orange-200 opacity-30 mix-blend-multiply blur-3xl animate-blob animation-delay-2000" />
			<div className="pointer-events-none absolute -bottom-8 left-20 h-96 w-96 rounded-full bg-pink-300 opacity-30 mix-blend-multiply blur-3xl animate-blob animation-delay-4000" />

			<div className="relative z-10 mx-auto grid max-w-6xl gap-x-16 gap-y-10 lg:grid-cols-[5fr_6fr] lg:grid-rows-[auto_1fr]">
				{/* Intro */}
				<motion.div {...fade} className="lg:col-start-1 lg:row-start-1">
					<h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
						Let's make your{" "}
						<span className="bg-gradient-to-r from-violet-600 to-pink-700 bg-clip-text text-transparent">
							home shine.
						</span>
					</h1>
					<p className="mt-5 max-w-md text-lg leading-relaxed text-slate-600">
						Questions, ideas, or something not working? Tell us what's going on
						and the right person will get back to you.
					</p>
					<ServiceIllustration
						scene="support"
						className="mt-6 mx-auto w-56 h-auto sm:w-64 lg:mx-0 lg:w-full lg:max-w-sm"
					/>
				</motion.div>

				{/* Form */}
				<motion.div
					{...fade}
					className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
				>
					<div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl shadow-purple-900/5 backdrop-blur-2xl sm:p-8">
						<AnimatePresence mode="wait" initial={false}>
							{sentReply ? (
								<motion.div
									key="sent"
									initial={{ opacity: 0, scale: 0.97 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0 }}
									className="py-8 text-center"
									role="status"
								>
									<motion.div
										initial={reduce ? false : { scale: 0.5 }}
										animate={{ scale: 1 }}
										transition={{ type: "spring", stiffness: 260, damping: 16 }}
										className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30"
									>
										<Check className="h-8 w-8" strokeWidth={3} />
									</motion.div>
									<h2 className="mt-6 text-2xl font-bold text-slate-900">
										Message sent
									</h2>
									<p className="mx-auto mt-3 max-w-sm leading-relaxed text-slate-600">
										{sentReply}
									</p>
									<p className="mt-2 text-sm text-slate-500">
										A confirmation is on its way to your inbox.
									</p>
									<button
										type="button"
										onClick={() => setSentReply(null)}
										className="mt-8 cursor-pointer rounded-full border border-violet-200 bg-white px-6 py-2.5 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
									>
										Send another message
									</button>
								</motion.div>
							) : (
								<motion.form
									key="form"
									ref={formRef}
									onSubmit={sendEmail}
									noValidate
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="space-y-6"
								>
									<div>
										<h2 className="text-2xl font-bold text-slate-900">
											Get in touch
										</h2>
										<p className="mt-1 text-sm text-slate-500">
											All fields are required. We reply by email.
										</p>
									</div>

									{/* values read by EmailJS sendForm */}
									<input type="hidden" name="subject" value={form.subject} />
									<input
										type="hidden"
										name="dynamic_message"
										value={currentReply}
									/>

									{/* Topic chips */}
									<fieldset>
										<legend className="mb-2 text-sm font-semibold text-slate-700">
											What brings you here?
										</legend>
										<div
											role="radiogroup"
											aria-label="Topic"
											className="flex flex-wrap gap-2"
										>
											{topics.map(({ value, label, icon: Icon }) => {
												const active = form.subject === value;
												return (
													<button
														key={value}
														type="button"
														role="radio"
														aria-checked={active}
														tabIndex={
															active || (!form.subject && value === "support")
																? 0
																: -1
														}
														onClick={() => pickTopic(value)}
														className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 ${
															active
																? "border-transparent bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-md shadow-violet-500/25"
																: "border-slate-200 bg-white/80 text-slate-600 hover:border-violet-300 hover:text-violet-700"
														}`}
													>
														<Icon className="h-4 w-4" />
														{label}
													</button>
												);
											})}
										</div>
										{showError("subject") && (
											<p
												role="alert"
												className="mt-2 flex items-center gap-1 text-xs font-medium text-rose-600"
											>
												<CircleAlert className="h-3.5 w-3.5" />
												{errors.subject}
											</p>
										)}

										<AnimatePresence initial={false}>
											{form.subject && (
												<motion.div
													key={form.subject}
													initial={reduce ? false : { opacity: 0, height: 0 }}
													animate={{ opacity: 1, height: "auto" }}
													exit={{ opacity: 0, height: 0 }}
													className="overflow-hidden"
												></motion.div>
											)}
										</AnimatePresence>
									</fieldset>

									<div className="grid gap-x-4 sm:grid-cols-2">
										<Field
											id="user_name"
											label="Your name"
											icon={User}
											error={showError("user_name")}
										>
											<input
												id="user_name"
												name="user_name"
												type="text"
												autoComplete="name"
												placeholder="Priya Sharma"
												value={form.user_name}
												onChange={handleChange}
												onBlur={handleBlur}
												aria-invalid={!!showError("user_name")}
												aria-describedby={
													showError("user_name") ? "user_name-error" : undefined
												}
												className={inputCls(!!showError("user_name"))}
											/>
										</Field>

										<Field
											id="user_email"
											label="Your email"
											icon={Mail}
											error={showError("user_email")}
										>
											<input
												id="user_email"
												name="user_email"
												type="email"
												autoComplete="email"
												placeholder="you@example.com"
												value={form.user_email}
												onChange={handleChange}
												onBlur={handleBlur}
												aria-invalid={!!showError("user_email")}
												aria-describedby={
													showError("user_email")
														? "user_email-error"
														: undefined
												}
												className={inputCls(!!showError("user_email"))}
											/>
										</Field>
									</div>

									<Field
										id="message"
										label="How can we help?"
										icon={MessageSquare}
										multiline
										error={showError("message")}
										hint={
											<span
												className={`tabular-nums ${
													form.message.length > MAX_MESSAGE - 50
														? "text-rose-500"
														: "text-slate-400"
												}`}
											>
												{form.message.length}/{MAX_MESSAGE}
											</span>
										}
									>
										<textarea
											id="message"
											name="message"
											rows={5}
											maxLength={MAX_MESSAGE}
											placeholder="Share as much detail as you can, such as the booking, the page, or what you expected to happen."
											value={form.message}
											onChange={handleChange}
											onBlur={handleBlur}
											aria-invalid={!!showError("message")}
											aria-describedby={
												showError("message") ? "message-error" : undefined
											}
											className={`${inputCls(!!showError("message"))} min-h-[9rem] resize-y`}
										/>
									</Field>

									<button
										type="submit"
										disabled={loading}
										className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
									>
										{loading ? (
											<>
												<LoaderCircle className="h-5 w-5 animate-spin" />
												Sending...
											</>
										) : (
											<>
												Send message <Send className="h-4 w-4" />
											</>
										)}
									</button>
								</motion.form>
							)}
						</AnimatePresence>
					</div>
				</motion.div>

				{/* Trust + help */}
				<motion.div
					{...fade}
					className="space-y-6 lg:col-start-1 lg:row-start-2 lg:self-start"
				>
					<ul className="divide-y divide-violet-100/80 rounded-2xl border border-white/60 bg-white/50 px-5 backdrop-blur-md">
						{trustPoints.map((item) => (
							<li
								key={item}
								className="flex items-center gap-3 py-3 text-[15px] font-medium text-slate-800"
							>
								<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
									<Check className="h-3 w-3" strokeWidth={3.5} />
								</span>
								{item}
							</li>
						))}
					</ul>

					<Link
						to="/help"
						className="group flex items-start gap-4 rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
					>
						<span className="shrink-0 rounded-xl bg-violet-100 p-3 text-violet-600">
							<MessageCircleQuestionMark className="h-6 w-6" />
						</span>
						<span>
							<span className="block text-lg font-bold text-slate-900">
								Looking for a quick answer?
							</span>
							<span className="mt-1 block text-sm leading-relaxed text-slate-600">
								The Help Center covers payments, refunds, and bookings, so you
								may not need to wait for a reply.
							</span>
							<span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-violet-700 group-hover:text-violet-900">
								Visit Help Center
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</span>
						</span>
					</Link>
				</motion.div>
			</div>
		</div>
	);
}

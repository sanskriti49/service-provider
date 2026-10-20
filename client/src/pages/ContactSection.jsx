import { useRef, useState, useEffect } from "react";
import emailjs from "@emailjs/browser";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import ServiceIllustration from "../ui/ServiceIllustration";
import {
	Check,
	CheckCircle2,
	ChevronDown,
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
const FIELD_ORDER = ["user_name", "user_email", "subject", "message"];

/* Palette: one violet family.
   ground  #DCD3FF   page
   panel   #EDE8FF   side card, soft fills
   ink     #1A1244   text
   brand   #4A2BE0   buttons, focus, links */

const topics = [
	{
		value: "support",
		label: "I need help",
		hint: "Bookings, payments and refunds go to our support team.",
	},
	{
		value: "bug",
		label: "I found a bug",
		hint: "Goes to our engineers. Tell us what broke.",
	},
	{
		value: "feature",
		label: "Feature request",
		hint: "Goes to our product team.",
	},
	{
		value: "love",
		label: "Just some love",
		hint: "We'll share it with the whole team.",
	},
	{
		value: "other",
		label: "Something else",
		hint: "We'll route it to the right person.",
	},
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
	if (!v.user_name.trim()) e.user_name = "Please enter your name.";
	if (!v.user_email.trim()) e.user_email = "Please enter your email.";
	else if (!EMAIL_RE.test(v.user_email.trim()))
		e.user_email = "Enter a valid email address, like you@example.com.";
	if (!v.subject) e.subject = "Choose a topic so we can route your message.";
	if (v.message.trim().length < 10)
		e.message = "Please add a few more details (at least 10 characters).";
	return e;
};

const inputCls = (hasError) =>
	`w-full rounded-xl border-2 bg-white px-4 py-3 text-base text-[#1A1244] outline-none transition-[border-color,box-shadow] placeholder:text-[#1A1244]/45 focus:ring-4 ${
		hasError
			? "border-rose-600 focus:ring-rose-600/20"
			: "border-[#1A1244]/15 hover:border-[#1A1244]/30 focus:border-[#4A2BE0] focus:ring-[#4A2BE0]/20"
	}`;

const labelCls = "mb-1.5 block text-sm font-bold text-[#1A1244]";

const FieldError = ({ id, children }) =>
	children ? (
		<p
			id={id}
			role="alert"
			className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-rose-700"
		>
			<CircleAlert className="h-4 w-4 shrink-0" />
			{children}
		</p>
	) : null;

export default function ContactSection() {
	const reduce = useReducedMotion();
	const formRef = useRef(null);
	const thanksRef = useRef(null);
	const [form, setForm] = useState(emptyForm);
	const [touched, setTouched] = useState({});
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(null); // { name, email, reply }

	useEffect(() => {
		emailjs.init(PUBLIC_KEY);
	}, []);

	// Move focus to the confirmation so screen readers announce it.
	useEffect(() => {
		if (sent) thanksRef.current?.focus();
	}, [sent]);

	const errors = validate(form);
	const showError = (k) => (touched[k] ? errors[k] : undefined);
	const currentReply = replyMessages[form.subject] || replyMessages.default;
	const activeTopic = topics.find((t) => t.value === form.subject);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setForm((f) => ({ ...f, [name]: value }));
	};
	const handleBlur = (e) =>
		setTouched((t) => ({ ...t, [e.target.name]: true }));

	const sendEmail = (e) => {
		e.preventDefault();
		if (loading) return;

		setTouched({
			subject: true,
			user_name: true,
			user_email: true,
			message: true,
		});
		const firstInvalid = FIELD_ORDER.find((k) => errors[k]);
		if (firstInvalid) {
			formRef.current.elements.namedItem(firstInvalid)?.focus();
			return;
		}

		setLoading(true);
		const snapshot = {
			name: form.user_name.trim().split(/\s+/)[0],
			email: form.user_email.trim(),
			reply: currentReply,
		};

		const request = emailjs
			.sendForm(SERVICE_ID, TEMPLATE_ADMIN, formRef.current, {
				publicKey: PUBLIC_KEY,
			})
			.then(() =>
				emailjs.send(SERVICE_ID, TEMPLATE_USER, {
					user_name: form.user_name,
					user_email: form.user_email,
					dynamic_message: snapshot.reply,
				}),
			);

		toast.promise(request, {
			loading: "Sending your message...",
			success: "Message sent",
			error: "Message not sent. Check your connection and try again.",
			className:
				"bricolage-grotesque rounded-xl bg-[#1A1244] px-5 py-4 text-base font-semibold text-white",
		});

		request
			.then(() => {
				setSent(snapshot);
				setForm(emptyForm);
				setTouched({});
			})
			.catch((err) => console.error("FAILED...", err))
			.finally(() => setLoading(false));
	};

	return (
		<div className="bricolage-grotesque min-h-screen w-full bg-[#DCD3FF] px-5 py-12 text-[#1A1244] sm:px-10 sm:py-16">
			<div className="mx-auto max-w-6xl">
				{/* Header: text on the left, illustration on the right, no boxed panel */}
				<header className="flex items-end justify-between gap-8">
					<div className="max-w-xl">
						<h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
							Contact us
						</h1>
						<p className="mt-3 text-lg leading-relaxed text-[#1A1244]/80">
							Have a question, a problem with a booking, or an idea? Send us a
							message and we&rsquo;ll reply by email.
						</p>
					</div>
					<ServiceIllustration
						scene="support"
						className="hidden h-auto w-44 shrink-0 sm:block lg:w-56"
					/>
				</header>

				{/* Both columns stretch to the same height, so nothing is left hanging */}
				<div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
					{/* Form card */}
					<main className="flex flex-col justify-center rounded-3xl bg-white p-6 shadow-sm sm:p-10">
						<AnimatePresence mode="wait" initial={false}>
							{sent ? (
								<motion.div
									key="sent"
									role="status"
									initial={reduce ? false : { opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="py-6 text-center sm:py-10"
								>
									<CheckCircle2
										aria-hidden="true"
										className="mx-auto h-14 w-14 text-[#4A2BE0]"
										strokeWidth={1.75}
									/>
									<h2
										ref={thanksRef}
										tabIndex={-1}
										className="mt-5 text-3xl font-extrabold tracking-tight outline-none"
									>
										Message sent, {sent.name}
									</h2>
									<p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-[#1A1244]/85">
										{sent.reply}
									</p>
									<p className="mt-4 text-base text-[#1A1244]/70">
										A confirmation is on its way to{" "}
										<span className="font-semibold text-[#1A1244]">
											{sent.email}
										</span>
										.
									</p>
									<button
										type="button"
										onClick={() => setSent(null)}
										className="mt-8 cursor-pointer rounded-xl border-2 border-[#1A1244] px-6 py-3 text-base font-bold transition-colors hover:bg-[#1A1244] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4A2BE0]/40"
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
									initial={reduce ? false : { opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="space-y-5"
								>
									{/* read by EmailJS sendForm */}
									<input
										type="hidden"
										name="dynamic_message"
										value={currentReply}
									/>

									<div className="mb-2">
										<h2 className="text-2xl font-extrabold tracking-tight">
											Send us a message
										</h2>
										<p className="mt-1 text-sm text-[#1A1244]/70">
											All fields are required.
										</p>
									</div>

									<div className="grid gap-5 sm:grid-cols-2">
										<div>
											<label htmlFor="user_name" className={labelCls}>
												Your name
											</label>
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
											<FieldError id="user_name-error">
												{showError("user_name")}
											</FieldError>
										</div>

										<div>
											<label htmlFor="user_email" className={labelCls}>
												Email address
											</label>
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
											<FieldError id="user_email-error">
												{showError("user_email")}
											</FieldError>
										</div>
									</div>

									<div>
										<label htmlFor="subject" className={labelCls}>
											What is this about?
										</label>
										<div className="relative">
											<select
												id="subject"
												name="subject"
												value={form.subject}
												onChange={handleChange}
												onBlur={handleBlur}
												aria-invalid={!!showError("subject")}
												aria-describedby={
													showError("subject")
														? "subject-error"
														: activeTopic
															? "subject-hint"
															: undefined
												}
												className={`${inputCls(!!showError("subject"))} cursor-pointer appearance-none pr-11 ${
													form.subject ? "" : "text-[#1A1244]/45"
												}`}
											>
												<option value="" disabled>
													Choose a topic
												</option>
												{topics.map((t) => (
													<option
														key={t.value}
														value={t.value}
														className="text-[#1A1244]"
													>
														{t.label}
													</option>
												))}
											</select>
											<ChevronDown
												aria-hidden="true"
												className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1A1244]/60"
											/>
										</div>
										{activeTopic && !showError("subject") && (
											<p
												id="subject-hint"
												className="mt-1.5 text-sm text-[#1A1244]/70"
											>
												{activeTopic.hint}
											</p>
										)}
										<FieldError id="subject-error">
											{showError("subject")}
										</FieldError>
									</div>

									<div>
										<label htmlFor="message" className={labelCls}>
											Message
										</label>
										<textarea
											id="message"
											name="message"
											rows={6}
											maxLength={MAX_MESSAGE}
											placeholder="Share as much detail as you can, such as the booking, the page, or what you expected to happen."
											value={form.message}
											onChange={handleChange}
											onBlur={handleBlur}
											aria-invalid={!!showError("message")}
											aria-describedby={
												showError("message") ? "message-error" : undefined
											}
											className={`${inputCls(!!showError("message"))} min-h-[9rem] resize-y leading-relaxed`}
										/>
										<div className="flex items-start justify-between gap-4">
											<FieldError id="message-error">
												{showError("message")}
											</FieldError>
											<span
												className={`ml-auto mt-1.5 text-sm tabular-nums ${
													form.message.length > MAX_MESSAGE - 50
														? "font-bold text-rose-700"
														: "text-[#1A1244]/65"
												}`}
											>
												{form.message.length}/{MAX_MESSAGE}
											</span>
										</div>
									</div>

									<button
										type="submit"
										disabled={loading}
										className="inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#4A2BE0] px-8 py-3.5 text-base font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4A2BE0]/40 focus-visible:ring-offset-2 enabled:hover:bg-[#1A1244] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
									>
										{loading ? (
											<>
												<LoaderCircle className="h-5 w-5 animate-spin" />
												Sending...
											</>
										) : (
											"Send message"
										)}
									</button>
								</motion.form>
							)}
						</AnimatePresence>
					</main>

					{/* Side card: one panel, same height as the form, help link pinned to its base */}
					<aside className="flex flex-col rounded-3xl bg-[#EDE8FF] p-6 sm:p-10">
						<h2 className="text-2xl font-extrabold tracking-tight">
							Why book with TaskGenie
						</h2>
						<ul className="mt-6 space-y-4">
							{trustPoints.map((item) => (
								<li
									key={item}
									className="flex items-center gap-3.5 text-base font-semibold"
								>
									<span
										aria-hidden="true"
										className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4A2BE0] text-white"
									>
										<Check className="h-3.5 w-3.5" strokeWidth={3.5} />
									</span>
									{item}
								</li>
							))}
						</ul>

						<Link
							to="/help"
							className="group mt-10 block rounded-2xl bg-white p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4A2BE0]/40 lg:mt-auto"
						>
							<span className="block text-lg font-extrabold tracking-tight">
								Looking for a quick answer?
							</span>
							<span className="mt-1 block text-[15px] leading-relaxed text-[#1A1244]/80">
								The Help Center covers payments, refunds, and bookings, so you
								may not need to wait for a reply.
							</span>
							<span className="mt-3 inline-block text-[15px] font-bold text-[#4A2BE0] underline decoration-2 underline-offset-4 group-hover:text-[#1A1244]">
								Visit Help Center
							</span>
						</Link>
					</aside>
				</div>
			</div>
		</div>
	);
}

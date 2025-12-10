import React from "react";
import { CalendarSync, CheckCircle, HandCoins, Users } from "lucide-react";

const WorkWUs = () => {
	return (
		<section className="bricolage-grotesque max-w-6xl mx-auto px-4 pb-9">
			<div className="flex flex-col md:flex-row items-center justify-center gap-6 py-10 text-center md:text-left">
				<div className="">
					<p className="font-medium text-violet-800/70">
						Grow Your Career With Us
					</p>
					<p className="mt-2 font-medium text-4xl text-[#281950]/95 leading-tight">
						Join our family of service experts and <br /> turn your talent into
						income.
					</p>
					<p className="mt-5 text-lg text-gray-800">
						At TaskGenie, we believe great talent deserves great opportunities.
						Whether you’re just starting out or looking to expand your career,
						our platform connects you with clients who value your skills. Work
						on your own terms, build your reputation, and enjoy the security of
						reliable payments — all in one place.
					</p>
				</div>

				<img
					src="/images/globe.png"
					alt="Work with us illustration"
					className="w-56 h-auto md:w-72"
				/>
			</div>

			<div className="h-1 w-24 mx-auto bg-gradient-to-r from-[#b369de] to-[#4f46e5] rounded-full"></div>

			{/* Benefits list */}
			<div
				className="mx-auto max-w-2xl rounded-3xl shadow-xl p-10 mt-6 
	bg-gradient-to-r from-pink-200/90 via-violet-300/70 to-indigo-200
	 backdrop-blur-sm"
			>
				<h3 className="text-2xl font-semibold mb-6 text-center">
					Why Work With Us
				</h3>

				<ol className="text-lg space-y-6">
					<li className="flex items-start gap-3">
						<CalendarSync className="text-violet-500 mt-1 w-5 h-5 flex-shrink-0 opacity-90" />
						<span>
							<strong>Flexible Work</strong> – Choose your own schedule.
						</span>
					</li>
					<li className="flex items-start gap-3">
						<CheckCircle className="text-violet-500 mt-1 w-5 h-5 flex-shrink-0 opacity-90" />
						<span>
							<strong>Grow Your Skills</strong> – Access new clients and
							opportunities.
						</span>
					</li>
					<li className="flex items-start gap-3">
						<HandCoins className="text-violet-500 mt-1 w-5 h-5 flex-shrink-0 opacity-90" />
						<span>
							<strong>Reliable Payments</strong> – Secure and on time, every
							time.
						</span>
					</li>
					<li className="flex items-start gap-3">
						<Users className="text-violet-500 mt-1 w-5 h-5 flex-shrink-0 opacity-90" />
						<span>
							<strong>Trusted Network</strong> – Join verified professionals.
						</span>
					</li>
				</ol>

				<div className="flex justify-center">
					<button
						className="cursor-pointer mt-10 px-10 py-3 rounded-full 
			bg-white/90 text-[#281950] font-semibold shadow-lg 
			hover:scale-105 transition hover:shadow-white/40"
					>
						Apply Now
					</button>
				</div>
			</div>
		</section>
	);
};

export default WorkWUs;

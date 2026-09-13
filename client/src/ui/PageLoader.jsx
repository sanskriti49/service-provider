import { Loader2 } from "lucide-react";

export default function PageLoader() {
	return (
		<div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-4 z-[9999]">
			<div className="relative flex items-center justify-center">
				<Loader2
					size={40}
					className="animate-spin text-violet-500 relative z-10"
				/>
			</div>
			<span className="text-slate-400 font-medium text-sm bricolage-grotesque tracking-wide">
				Loading TaskGenie...
			</span>
		</div>
	);
}

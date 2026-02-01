import {
	Audio,
	InfinitySpin,
	Oval,
	RotatingLines,
	TailSpin,
	ThreeDots,
} from "react-loader-spinner";

export default function PageLoader() {
	return (
		<div className="flex h-screen w-full items-center justify-center bg-white">
			{" "}
			<ThreeDots
				height="80"
				width="80"
				color="#7c3aed"
				ariaLabel="tail-spin-loading"
				radius="1"
				visible={true}
			/>
		</div>
	);
}

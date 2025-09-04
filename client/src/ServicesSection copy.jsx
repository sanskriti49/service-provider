import { ArrowRight } from "lucide-react";
import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import { IoIosArrowBack } from "react-icons/io";
import { IoIosArrowForward } from "react-icons/io";
import { useEffect, useState } from "react";
import axios from "axios";

const ServicesSection = () => {
	const [services, setServices] = useState([]);

	useEffect(() => {
		async function fetchServices() {
			try {
				const res = await axios.get("http://localhost:3000/api/services");
				setServices(res.data.services);
			} catch (err) {
				console.error("Failed to load services", err);
			}
		}
		fetchServices();
	}, []);
	const responsive = {
		superLargeDesktop: {
			// the naming can be any, depends on you.
			breakpoint: { max: 4000, min: 3000 },
			items: 5,
		},
		desktop: {
			breakpoint: { max: 3000, min: 1024 },
			items: 3,
		},
		tablet: {
			breakpoint: { max: 1024, min: 464 },
			items: 2,
		},
		mobile: {
			breakpoint: { max: 464, min: 0 },
			items: 1,
		},
	};

	const CustomLeftArrow = ({ onClick }) => (
		<button
			onClick={onClick}
			className="cursor-pointer absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-md transition-all duration-300 z-20"
		>
			<IoIosArrowBack size={24} />
		</button>
	);

	const CustomRightArrow = ({ onClick }) => (
		<button
			onClick={onClick}
			className="cursor-pointer absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-md transition-all duration-300 z-20"
		>
			<IoIosArrowForward size={24} />
		</button>
	);

	return (
		<section className="xl:mt-99 lg:mt-57 mt-47 relative bg-white overflow-hidden py-10 ">
			{/* Mesh Gradient (SVG) */}
			<div className="absolute inset-0 z-10 pointer-events-none">
				<svg
					width="100%"
					height="100%"
					viewBox="0 0 2336 1445"
					xmlns="http://www.w3.org/2000/svg"
					preserveAspectRatio="xMidYMid slice"
				>
					<defs>
						<radialGradient id="grad1" cx="30%" cy="30%" r="80%">
							<stop offset="0%" stop-color="#BDA3EE" stop-opacity="0.6" />
							<stop offset="100%" stop-color="#BDA3EE" stop-opacity="0" />
						</radialGradient>
						<radialGradient id="grad2" cx="70%" cy="30%" r="80%">
							<stop offset="0%" stop-color="#A5A6EC" stop-opacity="0.6" />
							<stop offset="100%" stop-color="#A5A6EC" stop-opacity="0" />
						</radialGradient>
						<radialGradient id="grad3" cx="50%" cy="80%" r="70%">
							<stop offset="0%" stop-color="#BABEED" stop-opacity="0.5" />
							<stop offset="100%" stop-color="#BABEED" stop-opacity="0" />
						</radialGradient>
					</defs>

					<rect width="100%" height="100%" fill="#ffffff" />
					<rect width="100%" height="100%" fill="url(#grad1)" />
					<rect width="100%" height="100%" fill="url(#grad2)" />
					<rect width="100%" height="100%" fill="url(#grad3)" />
				</svg>
			</div>

			<div className="relative z-10 max-w-5xl mx-auto text-gray-800 text-lg leading-relaxed">
				<h1 className="lg:text-4xl text-2xl bricolage-grotesque">
					Explore our services
				</h1>
				<div>
					{services.map((service) => (
						<div key={service.slug}>
							<h3>{service.name}</h3>
							<p>{service.description}</p>
						</div>
					))}
				</div>
				<div className="cursor-pointer">
					<Carousel
						swipeable={true}
						draggable={true}
						showDots={true}
						responsive={responsive}
						ssr={true}
						infinite={true}
						//autoPlay={true} // ✅ enable auto play
						autoPlaySpeed={3000} // 3 seconds
						keyBoardControl={true}
						customTransition="transform 500ms ease-in-out"
						transitionDuration={500}
						containerClass="carousel-container"
						dotListClass="custom-dot-list-style"
						itemClass="px-45" // ✅ spacing between items
						sliderClass="py-0" // optional vertical padding
						customLeftArrow={<CustomLeftArrow />}
						customRightArrow={<CustomRightArrow />}
					>
						<div className="relative w-80 h-80 my-20 group">
							<div className="absolute inset-0">
								<div className="transform rotate-3 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
									<div className="flex flex-col justify-between backdrop-blur-lg w-80 h-80 bg-white/10 border border-white/30 rounded-2xl p-6 shadow-lg transition-all duration-300 group-hover:bg-white/20 group-hover:shadow-xl">
										<h2 className="inter text-black/80 text-xl mb-2">
											Plumbing
										</h2>
										<div className="text-black/40 cursor-pointer inter-regular">
											<div className="flex justify-end gap-3 items-center group-hover:text-black transition-colors duration-300">
												<p className="transition-transform duration-300 group-hover:translate-x-1">
													View providers
												</p>
												<div className="rounded-full p-1 bg-[#212121] text-white transition-transform duration-300 group-hover:scale-110">
													<ArrowRight />
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="relative w-80 h-80 my-20 group">
							<div className="absolute inset-0">
								<div className="transform -rotate-3 transition-all duration-300 group-hover:scale-105 group-hover:-rotate-3">
									<div className="flex flex-col justify-between backdrop-blur-lg w-80 h-80 bg-white/10 border border-white/30 rounded-2xl p-6 shadow-lg transition-all duration-300 group-hover:bg-white/20 group-hover:shadow-xl">
										<h2 className="inter text-black/80 text-xl mb-2">
											Home Electrical Fixes
										</h2>
										<div className="text-black/40 cursor-pointer inter-regular">
											<div className="flex justify-end gap-3 items-center group-hover:text-black transition-colors duration-300">
												<p className="transition-transform duration-300 group-hover:translate-x-1">
													View providers
												</p>
												<div className="rounded-full p-1 bg-[#212121] text-white transition-transform duration-300 group-hover:scale-110">
													<ArrowRight />
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="relative w-80 h-80 my-20 group">
							<div className="absolute inset-0">
								<div className="transform rotate-3 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
									<div className="flex flex-col justify-between backdrop-blur-lg w-80 h-80 bg-white/10 border border-white/30 rounded-2xl p-6 shadow-lg transition-all duration-300 group-hover:bg-white/20 group-hover:shadow-xl">
										<h2 className="inter text-black/80 text-xl mb-2">
											At-Home Hair Styling
										</h2>
										<div className="text-black/40 cursor-pointer inter-regular">
											<div className="flex justify-end gap-3 items-center group-hover:text-black transition-colors duration-300">
												<p className="transition-transform duration-300 group-hover:translate-x-1">
													View providers
												</p>
												<div className="rounded-full p-1 bg-[#212121] text-white transition-transform duration-300 group-hover:scale-110">
													<ArrowRight />
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="relative w-80 h-80 my-20 group">
							<div className="absolute inset-0">
								<div className="transform -rotate-3 transition-all duration-300 group-hover:scale-105 group-hover:-rotate-3">
									<div className="flex flex-col justify-between backdrop-blur-lg w-80 h-80 bg-white/10 border border-white/30 rounded-2xl p-6 shadow-lg transition-all duration-300 group-hover:bg-white/20 group-hover:shadow-xl">
										<h2 className="inter text-black/80 text-xl mb-2">
											Lawn & Garden Care
										</h2>
										<div className="text-black/40 cursor-pointer inter-regular">
											<div className="flex justify-end gap-3 items-center group-hover:text-black transition-colors duration-300">
												<p className="transition-transform duration-300 group-hover:translate-x-1">
													View providers
												</p>
												<div className="rounded-full p-1 bg-[#212121] text-white transition-transform duration-300 group-hover:scale-110">
													<ArrowRight />
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="relative w-80 h-80 my-20 group">
							<div className="absolute inset-0">
								<div className="transform rotate-3 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
									<div className="flex flex-col justify-between backdrop-blur-lg w-80 h-80 bg-white/10 border border-white/30 rounded-2xl p-6 shadow-lg transition-all duration-300 group-hover:bg-white/20 group-hover:shadow-xl">
										<h2 className="inter text-black/80 text-xl mb-2">
											Personal Fitness Coach
										</h2>
										<div className="text-black/40 cursor-pointer inter-regular">
											<div className="flex justify-end gap-3 items-center group-hover:text-black transition-colors duration-300">
												<p className="transition-transform duration-300 group-hover:translate-x-1">
													View providers
												</p>
												<div className="rounded-full p-1 bg-[#212121] text-white transition-transform duration-300 group-hover:scale-110">
													<ArrowRight />
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="relative w-80 h-80 my-20 group">
							<div className="absolute inset-0">
								<div className="transform -rotate-3 transition-all duration-300 group-hover:scale-105 group-hover:-rotate-3">
									<div className="flex flex-col justify-between backdrop-blur-lg w-80 h-80 bg-white/10 border border-white/30 rounded-2xl p-6 shadow-lg transition-all duration-300 group-hover:bg-white/20 group-hover:shadow-xl">
										<h2 className="inter text-black/80 text-xl mb-2">
											Tech Support
										</h2>
										<div className="text-black/40 cursor-pointer inter-regular">
											<div className="flex justify-end gap-3 items-center group-hover:text-black transition-colors duration-300">
												<p className="transition-transform duration-300 group-hover:translate-x-1">
													View providers
												</p>
												<div className="rounded-full p-1 bg-[#212121] text-white transition-transform duration-300 group-hover:scale-110">
													<ArrowRight />
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</Carousel>
				</div>
			</div>
		</section>
	);
};

export default ServicesSection;

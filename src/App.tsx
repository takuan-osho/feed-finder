import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function App() {
	const [url, setUrl] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		console.log("Searching for feeds:", url);
		// TODO: Implement feed search functionality
	};

	return (
		<div className="relative flex min-h-screen flex-col bg-[#101a23] text-white">
			<div className="layout-container flex h-full grow flex-col">
				<header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#223649] px-10 py-3">
					<div className="flex items-center gap-4 text-white">
						<div className="size-4">
							<svg
								viewBox="0 0 48 48"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z"
									fill="currentColor"
								></path>
							</svg>
						</div>
						<h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
							FeedFinder
						</h2>
					</div>
					<div className="flex flex-1 justify-end gap-8">
						<div className="flex items-center gap-9">
							<a
								className="text-white text-sm font-medium leading-normal"
								href="#"
							>
								Home
							</a>
							<a
								className="text-white text-sm font-medium leading-normal"
								href="#"
							>
								About
							</a>
						</div>
					</div>
				</header>
				<div className="px-40 flex flex-1 justify-center py-5">
					<div className="layout-content-container flex flex-col max-w-[960px] flex-1">
						<h2 className="text-white tracking-light text-[28px] font-bold leading-tight px-4 text-center pb-3 pt-5">
							Find RSS Feeds
						</h2>
						<form
							onSubmit={handleSubmit}
							className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3"
						>
							<label className="flex flex-col min-w-40 flex-1">
								<Input
									placeholder="URLを入力してください"
									className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border border-[#314d68] bg-[#182734] focus:border-[#314d68] h-14 placeholder:text-[#90aecb] p-[15px] text-base font-normal leading-normal"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
								/>
							</label>
						</form>
						<div className="flex px-4 py-3 justify-center">
							<Button
								onClick={handleSubmit}
								className="bg-[#0b80ee] hover:bg-[#0b80ee]/80"
							>
								Find Feeds
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;

import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "VOICES - On-Device Text-to-Speech";
export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

export default async function Image() {
	return new ImageResponse(
		(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "black",
					color: "white",
				}}
			>
				{/* Background decorative elements */}
				<div
					style={{
						position: "absolute",
						top: "-20%",
						left: "-10%",
						width: "600px",
						height: "600px",
						borderRadius: "50%",
						background: "rgba(50, 50, 50, 0.2)",
						filter: "blur(80px)",
					}}
				/>
				<div
					style={{
						position: "absolute",
						bottom: "-20%",
						right: "-10%",
						width: "500px",
						height: "500px",
						borderRadius: "50%",
						background: "rgba(80, 80, 80, 0.1)",
						filter: "blur(100px)",
					}}
				/>

				{/* Content */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 10,
					}}
				>
					<h1
						style={{
							fontSize: 160,
							fontWeight: 800,
							letterSpacing: "-0.05em",
							margin: 0,
							lineHeight: 1,
							background: "linear-gradient(to bottom right, #ffffff, #a3a3a3)",
							backgroundClip: "text",
							color: "transparent",
						}}
					>
						VOICES
					</h1>
					<p
						style={{
							fontSize: 40,
							fontWeight: 300,
							letterSpacing: "0.2em",
							color: "#a3a3a3",
							marginTop: 20,
							textTransform: "uppercase",
						}}
					>
						On-Device Intelligence
					</p>
				</div>
			</div>
		),
		{
			...size,
		},
	);
}

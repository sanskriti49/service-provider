import TaskGenieLoader from "./TaskGenieLoader";

export default function PageLoader({ message, uploadPct, submessage }) {
	return (
		<TaskGenieLoader
			message={message}
			progress={uploadPct}
			submessage={submessage}
		/>
	);
}

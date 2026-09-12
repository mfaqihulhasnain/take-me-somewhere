import AdminConsole from "./admin-console-simple";

export const metadata = { title: "Control room — Take Me Somewhere", robots: { index: false, follow: false } };

export default function AdminPage() { return <div id="main-content" tabIndex="-1"><AdminConsole /></div>; }

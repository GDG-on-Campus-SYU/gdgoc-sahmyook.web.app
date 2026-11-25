import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";
import "../fonts/pretendard-v1.3.9/pretendardvariable-dynamic-subset.css";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export default function AdminPage() { return <AdminConsole />; }

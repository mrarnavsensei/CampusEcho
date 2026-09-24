"use client";
import { useEffect } from "react";
export default function PwaRegister() { useEffect(() => { if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") void navigator.serviceWorker.register("/sw.js").catch(error => console.error("Service worker registration failed", error)); }, []); return null; }

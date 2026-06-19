"use client";

import { useEffect } from "react";
import { isOnboardingCompleted, markOnboardingCompleted } from "@/lib/onboarding";


/**
 * Mounts and runs the Driver.js app-tour after first login.
 * All steps map to `id` attributes added to the relevant DOM elements.
 * Import and render once in the dashboard layout.
 */
export function OnboardingTour() {
  useEffect(() => {
    // Skip if already completed or SSR.
    if (typeof window === "undefined") return;
    if (isOnboardingCompleted()) return;

    // Inject driver.js CSS once via a <link> tag so we bypass the webpack
    // package-exports restriction on @import in globals.css.
    const DRIVER_CSS_ID = "driver-js-css";
    if (!document.getElementById(DRIVER_CSS_ID)) {
      const link = document.createElement("link");
      link.id = DRIVER_CSS_ID;
      link.rel = "stylesheet";
      // Use unpkg CDN — always available and avoids webpack resolution issues.
      link.href = "https://unpkg.com/driver.js@1.3.1/dist/driver.css";
      document.head.appendChild(link);
    }

    let destroyed = false;

    // Dynamically import driver.js to keep it out of the initial bundle.
    import("driver.js").then(({ driver }) => {
      if (destroyed) return;

      const driverObj = driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(11,28,48,0.75)",
        smoothScroll: true,
        allowClose: true,
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "moneyflow-driver-popover",
        nextBtnText: "Lanjut →",
        prevBtnText: "← Kembali",
        doneBtnText: "Mulai Sekarang 🚀",
        progressText: "{{current}} / {{total}}",
        onDestroyStarted: () => {
          markOnboardingCompleted();
          driverObj.destroy();
        },
        steps: [
          // Step 1 — Welcome (center modal, no target)
          {
            popover: {
              title: "Selamat datang 👋",
              description:
                "Siapkan akun kamu dalam waktu kurang dari satu menit. Kami akan memandu kamu melalui fitur-fitur paling penting.",
              side: "over" as never,
              align: "center"
            }
          },
          // Step 2 — Wallet section
          {
            element: "#wallet-list",
            popover: {
              title: "Dompet Kamu",
              description:
                "Semua dompet yang kamu buat akan tampil di sini. Pantau saldo, transfer dana, dan lihat riwayat transaksi.",
              side: "top",
              align: "start"
            }
          },
          // Step 3 — Add wallet button (on wallets page, but we link to it)
          {
            element: "#wallet-add-button",
            popover: {
              title: "Buat Dompet Pertama",
              description:
                "Sebelum mencatat transaksi, buat dompet dulu.\n\nContoh:\n• Cash\n• Rekening Bank\n• E-Wallet\n• Tabungan\n\nSaldo dan laporan akan dihitung dari dompet ini.",
              side: "bottom",
              align: "start"
            }
          },
          // Step 4 — FAB / plus button
          {
            element: "#floating-action-button",
            popover: {
              title: "Tambah Transaksi",
              description:
                'Ketuk tombol "+" kapan saja untuk mencatat pemasukan, pengeluaran, transfer, atau aktivitas keuangan lainnya.',
              side: "top",
              align: "center"
            }
          },
          // Step 5 — Reports nav
          {
            element: "#report-menu",
            popover: {
              title: "Laporan Keuangan",
              description:
                "Lihat tren pengeluaran, ringkasan pemasukan, breakdown kategori, dan performa dompet.",
              side: "top",
              align: "center"
            }
          },
          // Step 6 — Bottom navigation
          {
            element: "#bottom-navigation",
            popover: {
              title: "Navigasi Utama",
              description:
                "Gunakan menu ini untuk berpindah cepat antara Dashboard, Riwayat Transaksi, Laporan, dan Pengaturan.",
              side: "top",
              align: "center"
            }
          },
          // Step 7 — Completion (center modal)
          {
            popover: {
              title: "Kamu siap! 🚀",
              description:
                "Setup selesai. Mulai kelola keuanganmu dengan membuat dompet pertama dan mencatat transaksi pertamamu.",
              side: "over" as never,
              align: "center"
            }
          }
        ]
      });

      // Small delay so the dashboard content renders before highlighting.
      const t = window.setTimeout(() => {
        if (!destroyed) driverObj.drive();
      }, 800);

      // Cleanup if the component unmounts before the tour fires.
      return () => {
        destroyed = true;
        clearTimeout(t);
      };
    }).catch(() => {
      // If driver.js fails to load (offline, etc), just mark completed.
      markOnboardingCompleted();
    });

    return () => {
      destroyed = true;
    };
  }, []);

  return null;
}

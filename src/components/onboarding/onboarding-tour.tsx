"use client";

import type { DriveStep } from "driver.js";
import { markOnboardingCompleted } from "@/lib/onboarding";

const DRIVER_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Selamat datang 👋",
      description: "Siapkan akun kamu dalam waktu kurang dari satu menit. Kami akan memandu kamu melalui fitur-fitur paling penting.",
      side: "over" as never,
      align: "center"
    }
  },
  {
    element: "#wallet-list",
    popover: {
      title: "Dompet Kamu",
      description: "Semua dompet yang kamu buat akan tampil di sini. Pantau saldo, transfer dana, dan lihat riwayat transaksi.",
      side: "top",
      align: "start"
    }
  },
  {
    element: "#floating-action-button",
    popover: {
      title: "Tambah Transaksi",
      description: 'Ketuk tombol "+" kapan saja untuk mencatat pemasukan, pengeluaran, transfer, atau aktivitas keuangan lainnya.',
      side: "top",
      align: "center"
    }
  },
  {
    element: "#report-menu",
    popover: {
      title: "Laporan Keuangan",
      description: "Lihat tren pengeluaran, ringkasan pemasukan, breakdown kategori, dan performa dompet.",
      side: "top",
      align: "center"
    }
  },
  {
    element: "#bottom-navigation",
    popover: {
      title: "Navigasi Utama",
      description: "Gunakan menu ini untuk berpindah cepat antara Dashboard, Riwayat Transaksi, Laporan, dan Pengaturan.",
      side: "top",
      align: "center"
    }
  },
  {
    popover: {
      title: "Kamu siap! 🚀",
      description: "Setup selesai. Mulai kelola keuanganmu dengan membuat dompet pertama dan mencatat transaksi pertamamu.",
      side: "over" as never,
      align: "center"
    }
  }
];

function injectDriverCss() {
  const id = "driver-js-css";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/driver.js@1.3.1/dist/driver.css";
  document.head.appendChild(link);
}

/** Programmatically start the Driver.js tour. `onDone` fires when finished or skipped. */
export function startTour(onDone: () => void): void {
  if (typeof window === "undefined") return;
  injectDriverCss();

  import("driver.js")
    .then(({ driver }) => {
      const driverObj = driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(11,28,48,0.75)",
        smoothScroll: true,
        allowClose: true,
        stagePadding: 8,
        stageRadius: 12,
        nextBtnText: "Lanjut →",
        prevBtnText: "← Kembali",
        doneBtnText: "Mulai Sekarang 🚀",
        progressText: "{{current}} / {{total}}",
        onDestroyStarted: () => {
          markOnboardingCompleted();
          driverObj.destroy();
          onDone();
        },
        steps: DRIVER_STEPS
      });
      driverObj.drive();
    })
    .catch(() => {
      markOnboardingCompleted();
      onDone();
    });
}

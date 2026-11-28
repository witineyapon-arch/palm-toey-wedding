# Wedding WN — Planner & Checklist

PALM & TOEY · 12.12.2026

หน้า Planner สำหรับจัดการงานแต่ง: Checklist ความพร้อม, ค่าใช้จ่าย, รายรับรายจ่าย, รายชื่อแขก และส่งออก PDF

- ข้อมูลเก็บใน Supabase (ตาราง `planner_docs`, `planner_blobs`) ป้องกันด้วย Row Level Security
- เข้าได้เฉพาะอีเมลที่อยู่ในตาราง `planner_members` (ล็อกอินด้วยลิงก์ทางอีเมล)
- เพิ่มคนเข้าใช้: เพิ่มอีเมล (ตัวพิมพ์เล็ก) ลงตาราง `planner_members`
- ไฟล์นี้เป็นหน้าเว็บ static ไม่ต้อง build ใช้กับ GitHub Pages หรือ Vercel ได้ทันที

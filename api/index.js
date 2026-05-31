const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const app = express();

// Prisma 7 membutuhkan adapter untuk koneksi PostgreSQL
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_negara';

app.use(cors());
app.use(express.json());

// ... Sisa kode rute Express ke bawah (Auth & CRUD) biarkan tetap sama persis ...

// ... Sisa kode Express ke bawah (Auth & CRUD) biarkan tetap sama persis tidak ada yang diubah ...

// Rute Dasar
app.get('/api', (req, res) => {
  res.json({ message: 'API Mahasiswa Berjalan Lancar!' });
});

// ==================== AUTH ROUTER ====================

// Register User Baru (Untuk testing login)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: { username, password: hashedPassword }
    });
    
    res.status(201).json({ message: 'User berhasil didaftarkan', userId: user.id });
  } catch (error) {
    res.status(400).json({ error: 'Username sudah digunakan atau data tidak valid' });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login berhasil', token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware Autentikasi JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Akses ditolak, token tidak ditemukan' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token tidak valid atau kedaluwarsa' });
    req.user = user;
    next();
  });
};

// ==================== CRUD MAHASISWA (PROTECTED) ====================

// 1. Create Mahasiswa
app.post('/api/mahasiswa', authenticateToken, async (req, res) => {
  try {
    const { npm, nama } = req.body;
    const mhs = await prisma.mahasiswa.create({ data: { npm, nama } });
    res.status(201).json({ message: 'Data mahasiswa berhasil ditambahkan', data: mhs });
  } catch (error) {
    res.status(400).json({ error: 'NPM sudah terdaftar atau data tidak valid' });
  }
});

// 2. Read All Mahasiswa
app.get('/api/mahasiswa', authenticateToken, async (req, res) => {
  try {
    const mhsList = await prisma.mahasiswa.findMany({ orderBy: { id: 'asc' } });
    res.json(mhsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Update Mahasiswa
app.put('/api/mahasiswa/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { npm, nama } = req.body;
    const mhs = await prisma.mahasiswa.update({
      where: { id: parseInt(id) },
      data: { npm, nama }
    });
    res.json({ message: 'Data mahasiswa berhasil diperbarui', data: mhs });
  } catch (error) {
    res.status(400).json({ error: 'Gagal memperbarui data. Pastikan ID benar dan NPM tidak duplikat' });
  }
});

// 4. Delete Mahasiswa
app.delete('/api/mahasiswa/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.mahasiswa.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Data mahasiswa berhasil dihapus' });
  } catch (error) {
    res.status(400).json({ error: 'Gagal menghapus data, ID tidak ditemukan' });
  }
});

// Export untuk Vercel Serverless
module.exports = app;

// Jalankan lokal jika tidak di lingkungan vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
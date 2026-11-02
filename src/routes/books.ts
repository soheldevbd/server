import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { requireAuth } from '../auth';

export const bookRouter = Router();
const validCategories = ['Fiction', 'Science', 'History', 'Kids', 'Others'];
const mineAuth = (req: any, res: any, next: any) =>
  req.query.mine === 'true' ? requireAuth(req, res, next) : next();

// GET /books — public list; authenticated GET /books?mine=true — current user's books
bookRouter.get('/', mineAuth, async (req, res) => {
  try {
    const filter =
      req.query.mine === 'true' ? { addedByEmail: req.user!.email } : {};
    const limit = Math.min(Number(req.query.limit) || 100, 100);
    const books = await getDB()
      .collection('books')
      .find(filter)
      .sort({ addedAt: -1 })
      .limit(limit)
      .toArray();
    res.json({ books });
  } catch {
    res.status(500).json({ message: 'Could not fetch books' });
  }
});
bookRouter.get('/:id', async (req, res) => {
  const bookId = req.params.id;
  if (typeof bookId !== 'string' || !ObjectId.isValid(bookId))
    return res.status(400).json({ message: 'Invalid book id' });
  const book = await getDB()
    .collection('books')
    .findOne({ _id: new ObjectId(bookId) });
  if (!book) return res.status(404).json({ message: 'Book not found' });
  res.json({ book });
});
bookRouter.post('/', requireAuth, async (req, res) => {
  const {
    title,
    author,
    category,
    image,
    shortDescription,
    description,
    totalCopies,
  } = req.body;
  const copies = Number(totalCopies);
  if (
    !title ||
    !author ||
    !validCategories.includes(category) ||
    !image ||
    !shortDescription ||
    !Number.isInteger(copies) ||
    copies < 1
  )
    return res
      .status(400)
      .json({
        message: 'Please provide valid book details and at least one copy',
      });
  const book = {
    title: String(title).trim(),
    author: String(author).trim(),
    category,
    image,
    shortDescription,
    description: String(description || ''),
    totalCopies: copies,
    availableCopies: copies,
    addedAt: new Date(),
    addedById: req.user!.id,
    addedByName: req.user!.name || req.user!.email,
    addedByEmail: req.user!.email,
  };
  const result = await getDB().collection('books').insertOne(book);
  res
    .status(201)
    .json({
      message: 'Book created',
      book: { ...book, _id: result.insertedId },
    });
});
bookRouter.patch('/:id', requireAuth, async (req, res) => {
  const bookId = req.params.id;
  if (typeof bookId !== 'string' || !ObjectId.isValid(bookId))
    return res.status(400).json({ message: 'Invalid book id' });
  const db = getDB(),
    id = new ObjectId(bookId),
    old = await db.collection('books').findOne({ _id: id });
  if (!old) return res.status(404).json({ message: 'Book not found' });
  if (old.addedByEmail !== req.user!.email)
    return res
      .status(403)
      .json({ message: 'You can only edit your own books' });
  const allowed = [
      'title',
      'author',
      'category',
      'image',
      'shortDescription',
      'description',
      'totalCopies',
    ],
    update: any = {};
  for (const k of allowed)
    if (req.body[k] !== undefined) update[k] = req.body[k];
  if (update.category && !validCategories.includes(update.category))
    return res.status(400).json({ message: 'Invalid category' });
  if (update.totalCopies !== undefined) {
    const n = Number(update.totalCopies),
      borrowed = Number(old.totalCopies) - Number(old.availableCopies);
    if (!Number.isInteger(n) || n < borrowed)
      return res
        .status(400)
        .json({ message: 'Total copies cannot be less than borrowed copies' });
    update.totalCopies = n;
    update.availableCopies = n - borrowed;
  }
  await db.collection('books').updateOne({ _id: id }, { $set: update });
  res.json({ message: 'Book updated' });
});
bookRouter.delete('/:id', requireAuth, async (req, res) => {
  const bookId = req.params.id;
  if (typeof bookId !== 'string' || !ObjectId.isValid(bookId))
    return res.status(400).json({ message: 'Invalid book id' });
  const db = getDB(),
    id = new ObjectId(bookId),
    book = await db.collection('books').findOne({ _id: id });
  if (!book) return res.status(404).json({ message: 'Book not found' });
  if (book.addedByEmail !== req.user!.email)
    return res
      .status(403)
      .json({ message: 'You can only delete your own books' });
  const active = await db
    .collection('borrows')
    .countDocuments({ bookId: id.toString(), active: true });
  if (active)
    return res
      .status(409)
      .json({ message: 'This book has active borrows and cannot be deleted' });
  await db.collection('books').deleteOne({ _id: id });
  res.json({ message: 'Book deleted' });
});

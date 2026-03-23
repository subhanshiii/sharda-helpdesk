const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

const User = require('../models/User');
const Ticket = require('../models/Ticket');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sharda_helpdesk');
  console.log('MongoDB Connected for seeding...');
};

const seedData = async () => {
  await connectDB();

  await User.deleteMany({});
  await Ticket.deleteMany({});
  console.log('Cleared existing data');

  const adminUser = await User.create({
    name: 'Admin User',
    email: 'admin@sharda.ac.in',
    password: 'admin123',
    role: 'admin',
    department: 'Administration',
  });

  const itAgent = await User.create({
    name: 'Rahul Sharma',
    email: 'it.support@sharda.ac.in',
    password: 'agent123',
    role: 'agent',
    department: 'IT Support',
  });

  const hostelAgent = await User.create({
    name: 'Priya Singh',
    email: 'hostel.support@sharda.ac.in',
    password: 'agent123',
    role: 'agent',
    department: 'Hostel',
  });

  const libraryAgent = await User.create({
    name: 'Amit Kumar',
    email: 'library.support@sharda.ac.in',
    password: 'agent123',
    role: 'agent',
    department: 'Library',
  });

  const financeAgent = await User.create({
    name: 'Sneha Gupta',
    email: 'finance.support@sharda.ac.in',
    password: 'agent123',
    role: 'agent',
    department: 'Finance',
  });

  const academicAgent = await User.create({
    name: 'Dr. Vikram Patel',
    email: 'academic.support@sharda.ac.in',
    password: 'agent123',
    role: 'agent',
    department: 'Academic',
  });

  const infraAgent = await User.create({
    name: 'Suresh Yadav',
    email: 'infra.support@sharda.ac.in',
    password: 'agent123',
    role: 'agent',
    department: 'Infrastructure',
  });

  const adminAgent = await User.create({
    name: 'Meena Verma',
    email: 'admin.support@sharda.ac.in',
    password: 'agent123',
    role: 'agent',
    department: 'Administration',
  });

  console.log('✅ Agents created');

  const student1 = await User.create({
    name: 'John Student',
    email: 'student@sharda.ac.in',
    password: 'student123',
    role: 'student',
    department: 'Computer Science',
    enrollmentId: 'SU2024001',
  });

  const student2 = await User.create({
    name: 'Ananya Mishra',
    email: 'ananya@sharda.ac.in',
    password: 'student123',
    role: 'student',
    department: 'Electronics',
    enrollmentId: 'SU2024002',
  });

  const student3 = await User.create({
    name: 'Rohan Kapoor',
    email: 'rohan@sharda.ac.in',
    password: 'student123',
    role: 'student',
    department: 'Mechanical',
    enrollmentId: 'SU2024003',
  });

  console.log('✅ Students created');

  const tickets = [
    {
      title: 'Cannot access university WiFi',
      description: 'I am unable to connect to the university WiFi network since yesterday. I have tried restarting my device but the issue persists.',
      category: 'IT Support',
      priority: 'High',
      status: 'Open',
      user: student1._id,
    },
    {
      title: 'Library book renewal issue',
      description: 'I am unable to renew my library books online. The portal shows an error when I click renew.',
      category: 'Library',
      priority: 'Medium',
      status: 'In Progress',
      user: student1._id,
      assignedTo: libraryAgent._id,
    },
    {
      title: 'Hostel room heater not working',
      description: 'The room heater in room 204, Block B hostel is not working. The winters are getting cold and this needs urgent attention.',
      category: 'Hostel',
      priority: 'High',
      status: 'Open',
      user: student2._id,
      assignedTo: hostelAgent._id,
    },
    {
      title: 'Fee payment portal error',
      description: 'When trying to pay the semester fee, the portal shows Payment gateway error after entering card details.',
      category: 'Finance',
      priority: 'Critical',
      status: 'Resolved',
      user: student1._id,
      assignedTo: financeAgent._id,
    },
    {
      title: 'Exam schedule not visible on portal',
      description: 'The upcoming exam schedule for semester 5 is not showing on the student portal. Other students are facing the same issue.',
      category: 'Academic',
      priority: 'High',
      status: 'Open',
      user: student3._id,
      assignedTo: academicAgent._id,
    },
    {
      title: 'Classroom projector not working in Block C',
      description: 'The projector in room C-301 has not been working for 3 days. It affects all lectures happening in that room.',
      category: 'Infrastructure',
      priority: 'Medium',
      status: 'In Progress',
      user: student2._id,
      assignedTo: infraAgent._id,
    },
    {
      title: 'Bonafide certificate request',
      description: 'I need a bonafide certificate for my bank account opening. Please issue it at the earliest.',
      category: 'Administration',
      priority: 'Low',
      status: 'Open',
      user: student3._id,
      assignedTo: adminAgent._id,
    },
    {
      title: 'Student portal login not working',
      description: 'I cannot login to the student portal since the password reset. It shows invalid credentials even after reset.',
      category: 'IT Support',
      priority: 'Critical',
      status: 'Open',
      user: student2._id,
      assignedTo: itAgent._id,
    },
    {
      title: 'Scholarship form submission issue',
      description: 'The scholarship form on the portal is not accepting my documents. It shows file too large error even for small files.',
      category: 'Finance',
      priority: 'High',
      status: 'Closed',
      user: student1._id,
      assignedTo: financeAgent._id,
    },
    {
      title: 'Request for extra bookshelf in hostel room',
      description: 'Our hostel room does not have enough shelf space for books. Requesting an additional bookshelf for room 310 Block A.',
      category: 'Hostel',
      priority: 'Low',
      status: 'Open',
      user: student3._id,
    },
  ];

  const createdTickets = await Ticket.insertMany(tickets);
  console.log('✅ Tickets created');

  const ticket1 = await Ticket.findById(createdTickets[1]._id);
  ticket1.replies.push({ message: 'We are looking into this issue. Please try clearing your browser cache and try again.', author: libraryAgent._id, authorRole: 'agent' });
  ticket1.replies.push({ message: 'I tried clearing the cache but the issue still persists.', author: student1._id, authorRole: 'student' });
  ticket1.replies.push({ message: 'We have escalated this to the library IT team. Should be fixed within 24 hours.', author: libraryAgent._id, authorRole: 'agent' });
  await ticket1.save();

  const ticket2 = await Ticket.findById(createdTickets[2]._id);
  ticket2.replies.push({ message: 'Our maintenance team has been notified. They will visit room 204 Block B tomorrow morning.', author: hostelAgent._id, authorRole: 'agent' });
  ticket2.replies.push({ message: 'Thank you! Please let them know it is quite urgent as nights are very cold.', author: student2._id, authorRole: 'student' });
  await ticket2.save();

  const ticket3 = await Ticket.findById(createdTickets[3]._id);
  ticket3.replies.push({ message: 'The payment gateway issue has been fixed. Please try again and let us know if you face any issues.', author: financeAgent._id, authorRole: 'agent' });
  ticket3.replies.push({ message: 'It worked! Thank you so much.', author: student1._id, authorRole: 'student' });
  await ticket3.save();

  console.log('✅ Replies added');

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('========================================');
  console.log('           LOGIN CREDENTIALS            ');
  console.log('========================================');
  console.log('ADMIN:');
  console.log('  admin@sharda.ac.in           / admin123');
  console.log('');
  console.log('AGENTS (password: agent123)');
  console.log('  it.support@sharda.ac.in      → IT Support');
  console.log('  hostel.support@sharda.ac.in  → Hostel');
  console.log('  library.support@sharda.ac.in → Library');
  console.log('  finance.support@sharda.ac.in → Finance');
  console.log('  academic.support@sharda.ac.in→ Academic');
  console.log('  infra.support@sharda.ac.in   → Infrastructure');
  console.log('  admin.support@sharda.ac.in   → Administration');
  console.log('');
  console.log('STUDENTS (password: student123)');
  console.log('  student@sharda.ac.in         → John (CSE)');
  console.log('  ananya@sharda.ac.in          → Ananya (Electronics)');
  console.log('  rohan@sharda.ac.in           → Rohan (Mechanical)');
  console.log('========================================\n');

  process.exit(0);
};

seedData().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

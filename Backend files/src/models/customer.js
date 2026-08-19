const prisma = require("../config/database");

// Expose the Prisma Customer model to the controller
module.exports = prisma.customer;
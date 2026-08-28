// // const asyncHandler = require("express-async-handler");
// // const Customer = require("../models/Customer");
// // const Branch = require("../models/Branch");
// // const { signCustomerToken } = require("../middleware/customerAuth");

// // /**
// //  * Customer accounts for the shop.
// //  *
// //  * Email + password today; Google sign-in slots in alongside it later (the model
// //  * already carries googleId, and passwordHash is optional so a Google-only
// //  * account is valid).
// //  */

// // const MIN_PASSWORD = 8;

// // function normaliseEmail(value) {
// //   return String(value || "").trim().toLowerCase();
// // }

// // // POST /api/woven-essence/account/register
// // const register = asyncHandler(async (req, res) => {
// //   const name = String(req.body.name || "").trim();
// //   const email = normaliseEmail(req.body.email);
// //   const phone = String(req.body.phone || "").trim();
// //   const password = String(req.body.password || "");

// //   if (!name) {
// //     res.status(400);
// //     throw new Error("Please tell us your name");
// //   }
// //   if (!email) {
// //     res.status(400);
// //     throw new Error("Email is required");
// //   }
// //   if (password.length < MIN_PASSWORD) {
// //     res.status(400);
// //     throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
// //   }

// //   const existing = await Customer.findOne({ email });
// //   if (existing) {
// //     res.status(409);
// //     throw new Error("An account with this email already exists — please sign in instead");
// //   }

// //   // Only accept a branch that actually exists and is open.
// //   let preferredBranch = null;
// //   if (req.body.preferredBranch && /^[a-f\d]{24}$/i.test(req.body.preferredBranch)) {
// //     const branch = await Branch.findOne({
// //       _id: req.body.preferredBranch,
// //       isDeleted: { $ne: true },
// //       status: "active",
// //     });
// //     if (branch) preferredBranch = branch._id;
// //   }

// //   const customer = await Customer.create({
// //     name,
// //     email,
// //     phone,
// //     passwordHash: password, // hashed by the model's pre-save hook
// //     preferredBranch,
// //     lastLoginAt: new Date(),
// //   });

// //   res.status(201).json({
// //     success: true,
// //     data: { token: signCustomerToken(customer), customer: customer.toPublic() },
// //   });
// // });

// // // POST /api/woven-essence/account/login
// // const login = asyncHandler(async (req, res) => {
// //   const email = normaliseEmail(req.body.email);
// //   const password = String(req.body.password || "");

// //   if (!email || !password) {
// //     res.status(400);
// //     throw new Error("Enter your email and password");
// //   }

// //   // passwordHash is select:false, so ask for it explicitly.
// //   const customer = await Customer.findOne({ email, isDeleted: { $ne: true } }).select("+passwordHash");

// //   // One message for both "no such account" and "wrong password", so this
// //   // endpoint can't be used to discover which emails are registered.
// //   const ok = customer && (await customer.matchPassword(password));
// //   if (!ok) {
// //     res.status(401);
// //     throw new Error("Email or password is incorrect");
// //   }

// //   if (customer.status === "blocked") {
// //     res.status(403);
// //     throw new Error("This account has been suspended. Contact us for help.");
// //   }

// //   customer.lastLoginAt = new Date();
// //   await customer.save();

// //   res.json({
// //     success: true,
// //     data: { token: signCustomerToken(customer), customer: customer.toPublic() },
// //   });
// // });

// // // GET /api/woven-essence/account/me
// // const me = asyncHandler(async (req, res) => {
// //   res.json({ success: true, data: req.customer.toPublic() });
// // });

// // // PATCH /api/woven-essence/account/me
// // const updateProfile = asyncHandler(async (req, res) => {
// //   const customer = req.customer;

// //   if (req.body.name !== undefined) customer.name = String(req.body.name).trim();
// //   if (req.body.phone !== undefined) customer.phone = String(req.body.phone).trim();

// //   if (req.body.preferredBranch !== undefined) {
// //     const id = req.body.preferredBranch;
// //     if (!id) customer.preferredBranch = null;
// //     else if (/^[a-f\d]{24}$/i.test(id)) {
// //       const branch = await Branch.findOne({ _id: id, isDeleted: { $ne: true }, status: "active" });
// //       customer.preferredBranch = branch ? branch._id : customer.preferredBranch;
// //     }
// //   }

// //   // Email and password are changed through their own routes, never here.
// //   await customer.save();
// //   res.json({ success: true, data: customer.toPublic() });
// // });

// // // PATCH /api/woven-essence/account/password
// // const changePassword = asyncHandler(async (req, res) => {
// //   const current = String(req.body.currentPassword || "");
// //   const next = String(req.body.newPassword || "");

// //   if (next.length < MIN_PASSWORD) {
// //     res.status(400);
// //     throw new Error(`New password must be at least ${MIN_PASSWORD} characters`);
// //   }

// //   const customer = await Customer.findById(req.customer._id).select("+passwordHash");

// //   // A Google-only account has no password yet, so there is nothing to confirm.
// //   if (customer.passwordHash && !(await customer.matchPassword(current))) {
// //     res.status(401);
// //     throw new Error("Your current password is incorrect");
// //   }

// //   customer.passwordHash = next;
// //   await customer.save();
// //   res.json({ success: true, message: "Password updated" });
// // });

// // // POST /api/woven-essence/account/addresses
// // const addAddress = asyncHandler(async (req, res) => {
// //   const customer = req.customer;
// //   const address = {
// //     label: req.body.label,
// //     fullName: req.body.fullName,
// //     phone: req.body.phone,
// //     line1: req.body.line1,
// //     line2: req.body.line2,
// //     landmark: req.body.landmark,
// //     city: req.body.city,
// //     state: req.body.state,
// //     pincode: req.body.pincode,
// //     country: req.body.country || "India",
// //     isDefaultShipping: !!req.body.isDefaultShipping,
// //     isDefaultBilling: !!req.body.isDefaultBilling,
// //   };

// //   if (!address.line1 || !address.city || !address.pincode) {
// //     res.status(400);
// //     throw new Error("Address line, city and pincode are required");
// //   }

// //   // The first address saved becomes the default for both, otherwise a new
// //   // default demotes the previous one.
// //   const isFirst = customer.addresses.length === 0;
// //   if (isFirst) {
// //     address.isDefaultShipping = true;
// //     address.isDefaultBilling = true;
// //   }
// //   if (address.isDefaultShipping) customer.addresses.forEach((a) => (a.isDefaultShipping = false));
// //   if (address.isDefaultBilling) customer.addresses.forEach((a) => (a.isDefaultBilling = false));

// //   customer.addresses.push(address);
// //   await customer.save();
// //   res.status(201).json({ success: true, data: customer.toPublic() });
// // });

// // // DELETE /api/woven-essence/account/addresses/:addressId
// // const removeAddress = asyncHandler(async (req, res) => {
// //   const customer = req.customer;
// //   const before = customer.addresses.length;
// //   customer.addresses = customer.addresses.filter(
// //     (a) => String(a._id) !== String(req.params.addressId)
// //   );
// //   if (customer.addresses.length === before) {
// //     res.status(404);
// //     throw new Error("Address not found");
// //   }
// //   await customer.save();
// //   res.json({ success: true, data: customer.toPublic() });
// // });

// // module.exports = { register, login, me, updateProfile, changePassword, addAddress, removeAddress };









// const asyncHandler = require("express-async-handler");
// const Customer = require("../models/Customer");
// const Branch = require("../models/Branch");
// const { signCustomerToken } = require("../middleware/customerAuth");
// const google = require("../services/googleAuthService");

// /**
//  * Customer accounts for the shop.
//  *
//  * Email + password today; Google sign-in slots in alongside it later (the model
//  * already carries googleId, and passwordHash is optional so a Google-only
//  * account is valid).
//  */

// const MIN_PASSWORD = 8;

// function normaliseEmail(value) {
//   return String(value || "").trim().toLowerCase();
// }

// // POST /api/woven-essence/account/register
// const register = asyncHandler(async (req, res) => {
//   const name = String(req.body.name || "").trim();
//   const email = normaliseEmail(req.body.email);
//   const phone = String(req.body.phone || "").trim();
//   const password = String(req.body.password || "");

//   if (!name) {
//     res.status(400);
//     throw new Error("Please tell us your name");
//   }
//   if (!email) {
//     res.status(400);
//     throw new Error("Email is required");
//   }
//   if (password.length < MIN_PASSWORD) {
//     res.status(400);
//     throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
//   }

//   const existing = await Customer.findOne({ email });
//   if (existing) {
//     res.status(409);
//     throw new Error("An account with this email already exists — please sign in instead");
//   }

//   // Only accept a branch that actually exists and is open.
//   let preferredBranch = null;
//   if (req.body.preferredBranch && /^[a-f\d]{24}$/i.test(req.body.preferredBranch)) {
//     const branch = await Branch.findOne({
//       _id: req.body.preferredBranch,
//       isDeleted: { $ne: true },
//       status: "active",
//     });
//     if (branch) preferredBranch = branch._id;
//   }

//   const customer = await Customer.create({
//     name,
//     email,
//     phone,
//     passwordHash: password, // hashed by the model's pre-save hook
//     preferredBranch,
//     lastLoginAt: new Date(),
//   });

//   res.status(201).json({
//     success: true,
//     data: { token: signCustomerToken(customer), customer: customer.toPublic() },
//   });
// });

// // POST /api/woven-essence/account/login
// const login = asyncHandler(async (req, res) => {
//   const email = normaliseEmail(req.body.email);
//   const password = String(req.body.password || "");

//   if (!email || !password) {
//     res.status(400);
//     throw new Error("Enter your email and password");
//   }

//   // passwordHash is select:false, so ask for it explicitly.
//   const customer = await Customer.findOne({ email, isDeleted: { $ne: true } }).select("+passwordHash");

//   // One message for both "no such account" and "wrong password", so this
//   // endpoint can't be used to discover which emails are registered.
//   const ok = customer && (await customer.matchPassword(password));
//   if (!ok) {
//     res.status(401);
//     throw new Error("Email or password is incorrect");
//   }

//   if (customer.status === "blocked") {
//     res.status(403);
//     throw new Error("This account has been suspended. Contact us for help.");
//   }

//   customer.lastLoginAt = new Date();
//   await customer.save();

//   res.json({
//     success: true,
//     data: { token: signCustomerToken(customer), customer: customer.toPublic() },
//   });
// });

// // GET /api/woven-essence/account/me
// const me = asyncHandler(async (req, res) => {
//   res.json({ success: true, data: req.customer.toPublic() });
// });

// // PATCH /api/woven-essence/account/me
// const updateProfile = asyncHandler(async (req, res) => {
//   const customer = req.customer;

//   if (req.body.name !== undefined) customer.name = String(req.body.name).trim();
//   if (req.body.phone !== undefined) customer.phone = String(req.body.phone).trim();

//   if (req.body.preferredBranch !== undefined) {
//     const id = req.body.preferredBranch;
//     if (!id) customer.preferredBranch = null;
//     else if (/^[a-f\d]{24}$/i.test(id)) {
//       const branch = await Branch.findOne({ _id: id, isDeleted: { $ne: true }, status: "active" });
//       customer.preferredBranch = branch ? branch._id : customer.preferredBranch;
//     }
//   }

//   // Email and password are changed through their own routes, never here.
//   await customer.save();
//   res.json({ success: true, data: customer.toPublic() });
// });

// // PATCH /api/woven-essence/account/password
// const changePassword = asyncHandler(async (req, res) => {
//   const current = String(req.body.currentPassword || "");
//   const next = String(req.body.newPassword || "");

//   if (next.length < MIN_PASSWORD) {
//     res.status(400);
//     throw new Error(`New password must be at least ${MIN_PASSWORD} characters`);
//   }

//   const customer = await Customer.findById(req.customer._id).select("+passwordHash");

//   // A Google-only account has no password yet, so there is nothing to confirm.
//   if (customer.passwordHash && !(await customer.matchPassword(current))) {
//     res.status(401);
//     throw new Error("Your current password is incorrect");
//   }

//   customer.passwordHash = next;
//   await customer.save();
//   res.json({ success: true, message: "Password updated" });
// });

// // POST /api/woven-essence/account/addresses
// const addAddress = asyncHandler(async (req, res) => {
//   const customer = req.customer;
//   const address = {
//     label: req.body.label,
//     fullName: req.body.fullName,
//     phone: req.body.phone,
//     line1: req.body.line1,
//     line2: req.body.line2,
//     landmark: req.body.landmark,
//     city: req.body.city,
//     state: req.body.state,
//     pincode: req.body.pincode,
//     country: req.body.country || "India",
//     isDefaultShipping: !!req.body.isDefaultShipping,
//     isDefaultBilling: !!req.body.isDefaultBilling,
//   };

//   if (!address.line1 || !address.city || !address.pincode) {
//     res.status(400);
//     throw new Error("Address line, city and pincode are required");
//   }

//   // The first address saved becomes the default for both, otherwise a new
//   // default demotes the previous one.
//   const isFirst = customer.addresses.length === 0;
//   if (isFirst) {
//     address.isDefaultShipping = true;
//     address.isDefaultBilling = true;
//   }
//   if (address.isDefaultShipping) customer.addresses.forEach((a) => (a.isDefaultShipping = false));
//   if (address.isDefaultBilling) customer.addresses.forEach((a) => (a.isDefaultBilling = false));

//   customer.addresses.push(address);
//   await customer.save();
//   res.status(201).json({ success: true, data: customer.toPublic() });
// });

// // DELETE /api/woven-essence/account/addresses/:addressId
// const removeAddress = asyncHandler(async (req, res) => {
//   const customer = req.customer;
//   const before = customer.addresses.length;
//   customer.addresses = customer.addresses.filter(
//     (a) => String(a._id) !== String(req.params.addressId)
//   );
//   if (customer.addresses.length === before) {
//     res.status(404);
//     throw new Error("Address not found");
//   }
//   await customer.save();
//   res.json({ success: true, data: customer.toPublic() });
// });

// /**
//  * POST /api/woven-essence/account/google
//  *
//  * Body: { credential } — the ID token from Google Identity Services.
//  *
//  * Three cases, deliberately explicit:
//  *
//  *  1. Known googleId          → sign in.
//  *  2. Known email, no googleId → LINK the Google account to the existing one.
//  *     Safe because Google has verified the address, and the alternative (a
//  *     second account on the same email) is worse: the shopper's orders and
//  *     wishlist would silently vanish.
//  *  3. Neither                 → create an account with no password. They can add
//  *     one later via forgot-password if they ever want to sign in without Google.
//  */
// const googleSignIn = asyncHandler(async (req, res) => {
//   const profile = await google.verifyIdToken(req.body?.credential);

//   let customer = await Customer.findOne({ googleId: profile.googleId, isDeleted: { $ne: true } });
//   let created = false;

//   if (!customer) {
//     customer = await Customer.findOne({ email: profile.email, isDeleted: { $ne: true } });

//     if (customer) {
//       customer.googleId = profile.googleId; // link, don't duplicate
//     } else {
//       customer = new Customer({
//         name: profile.name || profile.email.split("@")[0],
//         email: profile.email,
//         googleId: profile.googleId,
//         // No passwordHash: a Google-only account has no password to store.
//       });
//       created = true;
//     }
//   }

//   if (customer.status === "blocked") {
//     res.status(403);
//     throw new Error("This account has been suspended. Please contact us.");
//   }

//   // Only fill a blank name — never overwrite a name the shopper chose here.
//   if (!customer.name && profile.name) customer.name = profile.name;

//   // Remember the store they were browsing, as email registration does.
//   if (!customer.preferredBranch && /^[a-f\d]{24}$/i.test(String(req.body?.branch || ""))) {
//     customer.preferredBranch = req.body.branch;
//   }

//   customer.lastLoginAt = new Date();
//   await customer.save();

//   res.status(created ? 201 : 200).json({
//     success: true,
//     data: { token: signCustomerToken(customer), customer: customer.toPublic() },
//     message: created ? `Welcome to Woven Essence, ${customer.name}` : `Welcome back, ${customer.name}`,
//   });
// });

// /** GET /api/woven-essence/account/google/config — lets the UI hide the button. */
// const googleConfig = asyncHandler(async (req, res) => {
//   res.json({ success: true, data: { enabled: google.isConfigured(), clientId: google.clientId() } });
// });

// module.exports = {
//   googleSignIn,
//   googleConfig, register, login, me, updateProfile, changePassword, addAddress, removeAddress };













 
const asyncHandler = require("express-async-handler");
const Customer = require("../models/Customer");
const Branch = require("../models/Branch");
const { signCustomerToken } = require("../middleware/customerAuth");
const google = require("../services/googleAuthService");
 
/**
 * Customer accounts for the shop.
 *
 * Email + password today; Google sign-in slots in alongside it later (the model
 * already carries googleId, and passwordHash is optional so a Google-only
 * account is valid).
 */
 
const MIN_PASSWORD = 8;
 
function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}
 
// POST /api/woven-essence/account/register
const register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normaliseEmail(req.body.email);
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
 
  if (!name) {
    res.status(400);
    throw new Error("Please tell us your name");
  }
  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }
  if (password.length < MIN_PASSWORD) {
    res.status(400);
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  }
 
  const existing = await Customer.findOne({ email });
  if (existing) {
    res.status(409);
    throw new Error("An account with this email already exists — please sign in instead");
  }
 
  // Only accept a branch that actually exists and is open.
  let preferredBranch = null;
  if (req.body.preferredBranch && /^[a-f\d]{24}$/i.test(req.body.preferredBranch)) {
    const branch = await Branch.findOne({
      _id: req.body.preferredBranch,
      isDeleted: { $ne: true },
      status: "active",
    });
    if (branch) preferredBranch = branch._id;
  }
 
  const customer = await Customer.create({
    name,
    email,
    phone,
    passwordHash: password, // hashed by the model's pre-save hook
    preferredBranch,
    lastLoginAt: new Date(),
  });
 
  res.status(201).json({
    success: true,
    data: { token: signCustomerToken(customer), customer: customer.toPublic() },
  });
});
 
// POST /api/woven-essence/account/login
const login = asyncHandler(async (req, res) => {
  const email = normaliseEmail(req.body.email);
  const password = String(req.body.password || "");
 
  if (!email || !password) {
    res.status(400);
    throw new Error("Enter your email and password");
  }
 
  // passwordHash is select:false, so ask for it explicitly.
  const customer = await Customer.findOne({ email, isDeleted: { $ne: true } }).select("+passwordHash");
 
  // One message for both "no such account" and "wrong password", so this
  // endpoint can't be used to discover which emails are registered.
  const ok = customer && (await customer.matchPassword(password));
  if (!ok) {
    res.status(401);
    throw new Error("Email or password is incorrect");
  }
 
  if (customer.status === "blocked") {
    res.status(403);
    throw new Error("This account has been suspended. Contact us for help.");
  }
 
  customer.lastLoginAt = new Date();
  await customer.save();
 
  res.json({
    success: true,
    data: { token: signCustomerToken(customer), customer: customer.toPublic() },
  });
});
 
// GET /api/woven-essence/account/me
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.customer.toPublic() });
});
 
// PATCH /api/woven-essence/account/me
const updateProfile = asyncHandler(async (req, res) => {
  const customer = req.customer;
 
  if (req.body.name !== undefined) customer.name = String(req.body.name).trim();
  if (req.body.phone !== undefined) customer.phone = String(req.body.phone).trim();
 
  if (req.body.preferredBranch !== undefined) {
    const id = req.body.preferredBranch;
    if (!id) customer.preferredBranch = null;
    else if (/^[a-f\d]{24}$/i.test(id)) {
      const branch = await Branch.findOne({ _id: id, isDeleted: { $ne: true }, status: "active" });
      customer.preferredBranch = branch ? branch._id : customer.preferredBranch;
    }
  }
 
  // Email and password are changed through their own routes, never here.
  await customer.save();
  res.json({ success: true, data: customer.toPublic() });
});
 
// PATCH /api/woven-essence/account/password
const changePassword = asyncHandler(async (req, res) => {
  const current = String(req.body.currentPassword || "");
  const next = String(req.body.newPassword || "");
 
  if (next.length < MIN_PASSWORD) {
    res.status(400);
    throw new Error(`New password must be at least ${MIN_PASSWORD} characters`);
  }
 
  const customer = await Customer.findById(req.customer._id).select("+passwordHash");
 
  // A Google-only account has no password yet, so there is nothing to confirm.
  if (customer.passwordHash && !(await customer.matchPassword(current))) {
    res.status(401);
    throw new Error("Your current password is incorrect");
  }
 
  customer.passwordHash = next;
  await customer.save();
  res.json({ success: true, message: "Password updated" });
});
 
// POST /api/woven-essence/account/addresses
const addAddress = asyncHandler(async (req, res) => {
  const customer = req.customer;
  const address = {
    label: req.body.label,
    fullName: req.body.fullName,
    phone: req.body.phone,
    line1: req.body.line1,
    line2: req.body.line2,
    landmark: req.body.landmark,
    city: req.body.city,
    state: req.body.state,
    pincode: req.body.pincode,
    country: req.body.country || "India",
    isDefaultShipping: !!req.body.isDefaultShipping,
    isDefaultBilling: !!req.body.isDefaultBilling,
  };
 
  if (!address.line1 || !address.city || !address.pincode) {
    res.status(400);
    throw new Error("Address line, city and pincode are required");
  }
 
  // The first address saved becomes the default for both, otherwise a new
  // default demotes the previous one.
  const isFirst = customer.addresses.length === 0;
  if (isFirst) {
    address.isDefaultShipping = true;
    address.isDefaultBilling = true;
  }
  if (address.isDefaultShipping) customer.addresses.forEach((a) => (a.isDefaultShipping = false));
  if (address.isDefaultBilling) customer.addresses.forEach((a) => (a.isDefaultBilling = false));
 
  customer.addresses.push(address);
  await customer.save();
  res.status(201).json({ success: true, data: customer.toPublic() });
});
 
// DELETE /api/woven-essence/account/addresses/:addressId
const removeAddress = asyncHandler(async (req, res) => {
  const customer = req.customer;
  const before = customer.addresses.length;
  customer.addresses = customer.addresses.filter(
    (a) => String(a._id) !== String(req.params.addressId)
  );
  if (customer.addresses.length === before) {
    res.status(404);
    throw new Error("Address not found");
  }
 
  // Deleting the default used to leave the account with none, so checkout
  // silently stopped prefilling. Promote the first remaining address instead.
  if (customer.addresses.length > 0) {
    if (!customer.addresses.some((a) => a.isDefaultShipping)) {
      customer.addresses[0].isDefaultShipping = true;
    }
    if (!customer.addresses.some((a) => a.isDefaultBilling)) {
      customer.addresses[0].isDefaultBilling = true;
    }
  }
 
  await customer.save();
  res.json({ success: true, data: customer.toPublic() });
});
 
/**
 * PATCH /api/woven-essence/account/addresses/:addressId
 *
 * Edits a saved address in place. Without this a shopper who moved had to
 * delete and retype the whole thing, which is exactly the retyping the address
 * book exists to remove.
 */
const updateAddress = asyncHandler(async (req, res) => {
  const customer = req.customer;
  const address = customer.addresses.id(req.params.addressId);
  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }
 
  const EDITABLE = [
    "label", "fullName", "phone", "line1", "line2",
    "landmark", "city", "state", "pincode", "country",
  ];
  EDITABLE.forEach((k) => {
    if (req.body[k] !== undefined) address[k] = req.body[k];
  });
 
  if (!address.line1 || !address.city || !address.pincode) {
    res.status(400);
    throw new Error("Address line, city and pincode are required");
  }
 
  // Defaults are exclusive, so setting one here has to clear the others.
  if (req.body.isDefaultShipping === true) {
    customer.addresses.forEach((a) => (a.isDefaultShipping = false));
    address.isDefaultShipping = true;
  }
  if (req.body.isDefaultBilling === true) {
    customer.addresses.forEach((a) => (a.isDefaultBilling = false));
    address.isDefaultBilling = true;
  }
 
  await customer.save();
  res.json({ success: true, data: customer.toPublic(), message: "Address updated" });
});
 
/**
 * PATCH /api/woven-essence/account/addresses/:addressId/default
 *
 * Separate from the edit above so "use this one by default" is one tap in the
 * address book rather than opening a form.
 */
const setDefaultAddress = asyncHandler(async (req, res) => {
  const customer = req.customer;
  const address = customer.addresses.id(req.params.addressId);
  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }
 
  // Both default to true: a shopper tapping "make default" almost always means
  // both, and the checkout only offers one address selector.
  const shipping = req.body.shipping !== false;
  const billing = req.body.billing !== false;
 
  if (shipping) {
    customer.addresses.forEach((a) => (a.isDefaultShipping = false));
    address.isDefaultShipping = true;
  }
  if (billing) {
    customer.addresses.forEach((a) => (a.isDefaultBilling = false));
    address.isDefaultBilling = true;
  }
 
  await customer.save();
  res.json({ success: true, data: customer.toPublic(), message: "Default address updated" });
});
 
/**
 * POST /api/woven-essence/account/google
 *
 * Body: { credential } — the ID token from Google Identity Services.
 *
 * Three cases, deliberately explicit:
 *
 *  1. Known googleId          → sign in.
 *  2. Known email, no googleId → LINK the Google account to the existing one.
 *     Safe because Google has verified the address, and the alternative (a
 *     second account on the same email) is worse: the shopper's orders and
 *     wishlist would silently vanish.
 *  3. Neither                 → create an account with no password. They can add
 *     one later via forgot-password if they ever want to sign in without Google.
 */
const googleSignIn = asyncHandler(async (req, res) => {
  const profile = await google.verifyIdToken(req.body?.credential);
 
  let customer = await Customer.findOne({ googleId: profile.googleId, isDeleted: { $ne: true } });
  let created = false;
 
  if (!customer) {
    customer = await Customer.findOne({ email: profile.email, isDeleted: { $ne: true } });
 
    if (customer) {
      customer.googleId = profile.googleId; // link, don't duplicate
    } else {
      customer = new Customer({
        name: profile.name || profile.email.split("@")[0],
        email: profile.email,
        googleId: profile.googleId,
        // No passwordHash: a Google-only account has no password to store.
      });
      created = true;
    }
  }
 
  if (customer.status === "blocked") {
    res.status(403);
    throw new Error("This account has been suspended. Please contact us.");
  }
 
  // Only fill a blank name — never overwrite a name the shopper chose here.
  if (!customer.name && profile.name) customer.name = profile.name;
 
  // Remember the store they were browsing, as email registration does.
  if (!customer.preferredBranch && /^[a-f\d]{24}$/i.test(String(req.body?.branch || ""))) {
    customer.preferredBranch = req.body.branch;
  }
 
  customer.lastLoginAt = new Date();
  await customer.save();
 
  res.status(created ? 201 : 200).json({
    success: true,
    data: { token: signCustomerToken(customer), customer: customer.toPublic() },
    message: created ? `Welcome to Woven Essence, ${customer.name}` : `Welcome back, ${customer.name}`,
  });
});
 
/** GET /api/woven-essence/account/google/config — lets the UI hide the button. */
const googleConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { enabled: google.isConfigured(), clientId: google.clientId() } });
});
 
module.exports = {
  googleSignIn,
  googleConfig, register, login, me, updateProfile, changePassword,
  addAddress, updateAddress, removeAddress, setDefaultAddress };

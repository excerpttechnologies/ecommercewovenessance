// const asyncHandler = require("express-async-handler");

// /**
//  * Enforces AdminUser.assignedBranch.
//  *
//  * The field has existed since the first release but nothing read it, so any
//  * branch_admin or staff member could see and change every branch's data simply
//  * by passing a different `?branch=`. This middleware closes that.
//  *
//  * How it works:
//  *   super_admin      — unrestricted, may pass any branch or none.
//  *   branch_admin     — pinned to assignedBranch. Their `?branch=` is overwritten
//  *   / staff            rather than validated, so an omitted or forged value both
//  *                      resolve to their own branch instead of "all branches".
//  *
//  * Overwriting rather than rejecting matters: if a scoped user omits the
//  * parameter, a validating guard would let the request through unfiltered and
//  * return every branch's rows.
//  */

// const UNRESTRICTED_ROLES = ["super_admin"];

// /** True when this admin may act on any branch. */
// function isUnrestricted(adminUser) {
//   return UNRESTRICTED_ROLES.includes(adminUser?.role);
// }

// const scopeToAssignedBranch = asyncHandler(async (req, res, next) => {
//   const admin = req.adminUser;

//   if (!admin) {
//     // protect() runs first, so this only fires if the middleware is mis-ordered.
//     res.status(401);
//     throw new Error("Not authorized");
//   }

//   if (isUnrestricted(admin)) return next();

//   const assigned = admin.assignedBranch;
//   if (!assigned) {
//     res.status(403);
//     throw new Error(
//       "Your account isn't assigned to a branch yet. Ask a super admin to set one before you can view store data."
//     );
//   }

//   const assignedId = String(assigned);

//   // A write naming a different branch is a real attempt to cross the boundary,
//   // so it is refused outright rather than silently rewritten.
//   const bodyBranch = req.body?.branch;
//   if (bodyBranch && String(bodyBranch) !== assignedId) {
//     res.status(403);
//     throw new Error("You can only work within your own branch");
//   }

//   // Reads are pinned. Assigning to req.query is safe on Express 4; on Express 5
//   // the getter is read-only, hence the defineProperty fallback.
//   const pinned = { ...req.query, branch: assignedId };
//   try {
//     req.query = pinned;
//   } catch {
//     Object.defineProperty(req, "query", { value: pinned, writable: true, configurable: true });
//   }

//   // Creates inherit the branch, so a scoped admin never has to send it.
//   if (req.method === "POST" && req.body && typeof req.body === "object" && !req.body.branch) {
//     req.body.branch = assignedId;
//   }

//   req.scopedBranch = assignedId;
//   next();
// });

// /**
//  * Resource-level check, for routes that act on a document by id.
//  *
//  * Query scoping alone doesn't protect `PUT /items/:id` — the id is enough to
//  * reach the document without any branch parameter. Called from crudFactory and
//  * branchController once the document is loaded.
//  *
//  * Throws a 404 rather than a 403 deliberately: telling someone "that exists but
//  * isn't yours" confirms the id is real.
//  */
// function assertBranchAccess(req, doc, entityName = "Record") {
//   if (!doc || isUnrestricted(req.adminUser)) return;

//   const assigned = req.adminUser?.assignedBranch;
//   if (!assigned) {
//     const err = new Error("Your account isn't assigned to a branch");
//     err.statusCode = 403;
//     throw err;
//   }

//   // Branch documents identify themselves by _id; everything else by .branch.
//   const docBranch = doc.branch ? String(doc.branch) : String(doc._id);

//   if (docBranch !== String(assigned)) {
//     const err = new Error(`${entityName} not found`);
//     err.statusCode = 404;
//     throw err;
//   }
// }

// module.exports = { scopeToAssignedBranch, assertBranchAccess, isUnrestricted };













const asyncHandler = require("express-async-handler");

/**
 * Enforces AdminUser.assignedBranch.
 *
 * The field has existed since the first release but nothing read it, so any
 * branch_admin or staff member could see and change every branch's data simply
 * by passing a different `?branch=`. This middleware closes that.
 *
 * How it works:
 *   super_admin      — unrestricted, may pass any branch or none.
 *   branch_admin     — pinned to assignedBranch. Their `?branch=` is overwritten
 *   / staff            rather than validated, so an omitted or forged value both
 *                      resolve to their own branch instead of "all branches".
 *
 * Overwriting rather than rejecting matters: if a scoped user omits the
 * parameter, a validating guard would let the request through unfiltered and
 * return every branch's rows.
 */

const UNRESTRICTED_ROLES = ["super_admin"];

/** True when this admin may act on any branch. */
function isUnrestricted(adminUser) {
  return UNRESTRICTED_ROLES.includes(adminUser?.role);
}

const scopeToAssignedBranch = asyncHandler(async (req, res, next) => {
  const admin = req.adminUser;

  if (!admin) {
    // protect() runs first, so this only fires if the middleware is mis-ordered.
    res.status(401);
    throw new Error("Not authorized");
  }

  if (isUnrestricted(admin)) return next();

  const assigned = admin.assignedBranch;
  if (!assigned) {
    res.status(403);
    throw new Error(
      "Your account isn't assigned to a branch yet. Ask a super admin to set one before you can view store data."
    );
  }

  const assignedId = String(assigned);

  // A write naming a different branch is a real attempt to cross the boundary,
  // so it is refused outright rather than silently rewritten.
  const bodyBranch = req.body?.branch;
  if (bodyBranch && String(bodyBranch) !== assignedId) {
    res.status(403);
    throw new Error("You can only work within your own branch");
  }

  // Reads are pinned. Assigning to req.query is safe on Express 4; on Express 5
  // the getter is read-only, hence the defineProperty fallback.
  const pinned = { ...req.query, branch: assignedId };
  try {
    req.query = pinned;
  } catch {
    Object.defineProperty(req, "query", { value: pinned, writable: true, configurable: true });
  }

  // Creates inherit the branch, so a scoped admin never has to send it.
  if (req.method === "POST" && req.body && typeof req.body === "object" && !req.body.branch) {
    req.body.branch = assignedId;
  }

  req.scopedBranch = assignedId;
  next();
});

/**
 * Resource-level check, for routes that act on a document by id.
 *
 * Query scoping alone doesn't protect `PUT /items/:id` — the id is enough to
 * reach the document without any branch parameter. Called from crudFactory and
 * branchController once the document is loaded.
 *
 * Throws a 404 rather than a 403 deliberately: telling someone "that exists but
 * isn't yours" confirms the id is real.
 *
 * MULTI-STORE ORDERS: an order now names a fulfilling branch AND every branch it
 * collects stock from. A store's admin has a legitimate interest in an order
 * that takes one of their sarees even when another store ships it, so
 * sourceBranches counts as access too. Without this, opening the shop to
 * cross-store carts would quietly hide those orders from the store that owes
 * the stock.
 */
function assertBranchAccess(req, doc, entityName = "Record") {
  if (!doc || isUnrestricted(req.adminUser)) return;

  const assigned = req.adminUser?.assignedBranch;
  if (!assigned) {
    const err = new Error("Your account isn't assigned to a branch");
    err.statusCode = 403;
    throw err;
  }

  const assignedId = String(assigned);

  // Branch documents identify themselves by _id; everything else by .branch.
  const docBranch = doc.branch ? String(doc.branch) : String(doc._id);
  if (docBranch === assignedId) return;

  // An order this store contributes stock to is theirs to see.
  const sources = Array.isArray(doc.sourceBranches) ? doc.sourceBranches : [];
  if (sources.some((s) => String(s?.branch) === assignedId)) return;

  const err = new Error(`${entityName} not found`);
  err.statusCode = 404;
  throw err;
}

/**
 * Mongo filter matching orders a branch is involved in, either as the shipper or
 * as a source of stock. Used by the admin order list.
 */
function orderBranchFilter(branchId) {
  return { $or: [{ branch: branchId }, { "sourceBranches.branch": branchId }] };
}

module.exports = { scopeToAssignedBranch, assertBranchAccess, isUnrestricted, orderBranchFilter };
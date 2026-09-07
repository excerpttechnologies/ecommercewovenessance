const Group = require("../models/Group");
const Subgroup = require("../models/Subgroup");
const ProductGroup = require("../models/ProductGroup");
const ErpItem = require("../models/ErpItem");
const ErpBusiness = require("../models/ErpBusiness");
const Branch = require("../models/Branch");

/**
 * Mirrors an ERP product group (and one of its items) into this branch.
 *
 * WHY THIS EXISTS
 * The ERP owns the catalogue, and the Groups screen publishes ERP product
 * groups to the shop header. But an Item here cannot be created without a
 * Woven Essence Group and Subgroup: they are required refs, they are checked
 * against the branch, and the item code is built from their codes
 * (branchCode-groupCode-subgroupCode-seq). Pointing those fields at ERP ids
 * would break the code generator, the storefront filters and the facets all at
 * once.
 *
 * So instead of rewriting that chain, the ERP row gets a local counterpart the
 * first time someone files a product under it. The counterpart carries
 * erpProductGroup / erpItem so the pairing is recorded rather than guessed
 * from names — two ERP businesses genuinely do have groups called
 * "PLAIN FABRICS", and matching on the name would merge them.
 *
 * Mirrors are created on demand, not when a group is published: publishing is
 * about the shop header, and most published groups never have a product filed
 * under them in a given branch.
 */

/**
 * Builds a group/subgroup code from a name.
 *
 * These end up inside the item code, so they are squeezed to something short
 * and predictable — letters and digits only, uppercased.
 */
function codeFrom(name, fallback) {
  const cleaned = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);
  return cleaned || fallback;
}

/**
 * Finds a code nobody in this scope is using yet.
 *
 * Group codes are unique per branch and subgroup codes unique per group, so a
 * second ERP group whose name squeezes to the same string would collide. The
 * suffix is only added when it has to be.
 */
async function uniqueCode(Model, scope, field, base) {
  let candidate = base;
  for (let n = 2; n < 100; n += 1) {
    const taken = await Model.exists({ ...scope, [field]: candidate });
    if (!taken) return candidate;
    candidate = `${base.slice(0, 10)}${n}`;
  }
  // Astronomically unlikely; a timestamp still beats throwing here.
  return `${base.slice(0, 8)}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

/**
 * Returns { group, subgroup } Woven Essence ids for an ERP group + item pair,
 * creating either one if this branch has not used it before.
 *
 * Throws with a message meant for the person on the form, not a stack trace.
 */
async function mirrorErpSelection({ branchId, erpGroupId, erpItemId }) {
  if (!branchId) throw new Error("branch is required");
  if (!erpGroupId) throw new Error("Select a group");
  if (!erpItemId) throw new Error("Select an item");

  const [erpGroup, erpItem] = await Promise.all([
    ProductGroup.findById(erpGroupId).select("name").lean(),
    ErpItem.findById(erpItemId).select("name subGroupId").lean(),
  ]);
  if (!erpGroup) throw new Error("That group no longer exists in the ERP");
  if (!erpItem) throw new Error("That item no longer exists in the ERP");

  // The item must sit under the chosen group, or under one of its children.
  //
  // The second case is the normal one: in this database no group has an item
  // directly beneath it, they all hang off a child group. Checking only for a
  // direct match would reject every real selection. Without any check at all a
  // stale form could file a product under an unrelated group, and the mismatch
  // would surface much later in a report.
  const childIds = await ProductGroup.find({ parentId: erpGroupId })
    .select("_id")
    .lean();
  const allowed = new Set([
    String(erpGroupId),
    ...childIds.map((c) => String(c._id)),
  ]);
  if (!allowed.has(String(erpItem.subGroupId))) {
    throw new Error("That item does not belong to the selected group");
  }

  let group = await Group.findOne({
    branch: branchId,
    erpProductGroup: erpGroupId,
    isDeleted: { $ne: true },
  });

  if (!group) {
    const base = codeFrom(erpGroup.name, "GRP");
    group = await Group.create({
      branch: branchId,
      erpProductGroup: erpGroupId,
      groupName: erpGroup.name || "Group",
      groupCode: await uniqueCode(Group, { branch: branchId }, "groupCode", base),
      // Mirrors are live the moment they exist — the ERP row they came from is
      // already published, and a draft here would hide the product.
      status: "active",
      lifecycleStage: "published",
    });
  }

  let subgroup = await Subgroup.findOne({
    group: group._id,
    erpItem: erpItemId,
    isDeleted: { $ne: true },
  });

  if (!subgroup) {
    const base = codeFrom(erpItem.name, "SUB");
    subgroup = await Subgroup.create({
      branch: branchId,
      group: group._id,
      erpItem: erpItemId,
      subgroupName: erpItem.name || "Item",
      subgroupCode: await uniqueCode(Subgroup, { group: group._id }, "subgroupCode", base),
      status: "active",
      lifecycleStage: "published",
    });
  }

  return { group: group._id, subgroup: subgroup._id };
}

/**
 * Returns the Woven Essence branch for an ERP branch, creating it if this is
 * the first time the ERP branch has been used.
 *
 * Products, orders and staff reference a Woven Essence Branch by _id, so an
 * ERP branch on its own has nothing for them to hang off. That pairing used to
 * be set by hand on Branch management; it is derived here instead, so the ERP
 * branch list is the only one anybody has to think about.
 *
 * An existing pairing always wins — the branches already carrying products
 * keep them. Only an ERP branch nobody has used before gets a new record, and
 * its details are copied across so the two are recognisably the same place.
 */
async function mirrorErpBranch(erpBusinessId) {
  if (!erpBusinessId) throw new Error("No branch selected");

  const existing = await Branch.findOne({
    erpBusinessId,
    isDeleted: { $ne: true },
  }).select("_id");
  if (existing) return String(existing._id);

  const business = await ErpBusiness.findById(erpBusinessId).lean();
  if (!business) throw new Error("That branch no longer exists in the ERP");

  const branch = await Branch.create({
    erpBusinessId,
    branchName: business.businessPrintName || business.name || "Branch",
    branchCode: await Branch.generateBranchCode(),
    address: {
      line1: [business.addressLine1, business.addressLine2].filter(Boolean).join(", "),
      city: business.city || "",
      state: business.state || "",
      pincode: business.zipCode || "",
    },
    // The ERP validates its own GST. Copying one that fails this app's
    // 15-character rule would reject the whole create, so it is only taken
    // when it already fits.
    gstNumber: /^[0-9A-Z]{15}$/.test(String(business.gstin || "")) ? business.gstin : undefined,
    contact: { phone: business.mobile || "", email: business.email || "" },
    status: "active",
    lifecycleStage: "published",
  });

  return String(branch._id);
}

module.exports = { mirrorErpSelection, mirrorErpBranch };

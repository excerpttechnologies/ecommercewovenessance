/**
 * Shared list-query builder used by every "listing page" module (branches,
 * groups, subgroups, items, orders, ...) so filters/search/date-range/
 * pagination behave identically across the admin panel per spec Section 5.1.
 */
class ApiFeatures {
  constructor(query, reqQuery) {
    this.query = query; // Mongoose query
    this.reqQuery = reqQuery; // req.query
  }

  search(fields = []) {
    const { q } = this.reqQuery;
    if (q && fields.length) {
      const regex = new RegExp(q.trim(), "i");
      this.query = this.query.find({ $or: fields.map((f) => ({ [f]: regex })) });
    }
    return this;
  }

  filter(allowedFields = []) {
    allowedFields.forEach((field) => {
      const val = this.reqQuery[field];
      if (val !== undefined && val !== "") {
        this.query = this.query.find({ [field]: val });
      }
    });
    return this;
  }

  dateRange(field = "createdAt") {
    const { dateFrom, dateTo } = this.reqQuery;
    if (dateFrom || dateTo) {
      const range = {};
      if (dateFrom) range.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      this.query = this.query.find({ [field]: range });
    }
    return this;
  }

  excludeDeleted() {
    if (this.reqQuery.includeDeleted !== "true") {
      this.query = this.query.find({ isDeleted: { $ne: true } });
    }
    return this;
  }

  sort() {
    const sortBy = this.reqQuery.sortBy
      ? this.reqQuery.sortBy.split(",").join(" ")
      : "-createdAt";
    this.query = this.query.sort(sortBy);
    return this;
  }

  async paginate() {
    const page = Math.max(parseInt(this.reqQuery.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(this.reqQuery.limit, 10) || 20, 1), 200);
    const skip = (page - 1) * limit;

    // Count on a clone before applying skip/limit
    const total = await this.query.model.countDocuments(this.query.getFilter());
    this.query = this.query.skip(skip).limit(limit);

    return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
  }
}

module.exports = ApiFeatures;

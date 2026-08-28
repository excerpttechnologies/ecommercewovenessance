const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Storefront traffic, aggregated.
 *
 * Deliberately stores NO personal data — no IP address, no user agent, no
 * customer id, no cookie. One counter row per day / branch / page type, plus a
 * count of distinct anonymous sessions. That is enough to answer "how many
 * visitors yesterday" and "which pages do they land on" without keeping
 * anything that identifies a person.
 *
 * `sessions` counts first-hits from a random id the browser keeps in
 * sessionStorage for the tab's lifetime. It resets when the tab closes, so it
 * approximates visits rather than people — which is the honest thing to report.
 */

const visitSchema = new Schema(
  {
    /** Midnight UTC of the day being counted. */
    day: { type: Date, required: true, index: true },

    branch: { type: Schema.Types.ObjectId, ref: "Branch", default: null, index: true },

    /** Coarse page type, never the full URL (a product slug is not a page type). */
    pageType: {
      type: String,
      enum: ["home", "catalog", "product", "cart", "checkout", "account", "other"],
      required: true,
    },

    /** Total page views. */
    views: { type: Number, default: 0 },

    /** Distinct anonymous sessions that hit this page type on this day. */
    sessions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

visitSchema.index({ day: 1, branch: 1, pageType: 1 }, { unique: true });

/** Midnight UTC for a given moment, so a day bucket is stable across servers. */
visitSchema.statics.dayKey = function dayKey(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

module.exports = mongoose.model("Visit", visitSchema);

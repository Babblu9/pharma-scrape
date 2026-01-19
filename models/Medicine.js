import mongoose from 'mongoose';

const SafetyAdviceSchema = new mongoose.Schema({
    status: { type: String, default: "UNKNOWN" },
    details: { type: String, default: "" }
}, { _id: false });

const SubstituteSchema = new mongoose.Schema({
    name: String,
    price: String,
    url: String
}, { _id: false });

const FAQSchema = new mongoose.Schema({
    question: String,
    answer: String
}, { _id: false });

const MedicineSchema = new mongoose.Schema({
    // Basic Details
    name: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    id: Number,
    letter: String,
    formula: String,
    packSize: String,
    price: String,
    image: String,

    // New Fields
    prescriptionRequired: { type: Boolean, default: false },
    storage: String,
    marketer: {
        name: String,
        url: String
    },
    saltComposition: {
        name: String,
        url: String
    },

    // Rich Details
    introduction: String,
    uses: [String],
    benefits: String,

    sideEffects: {
        summary: String,
        common: [String]
    },

    howToUse: String,
    howItWorks: String,

    // Safety Advice (Keyed objects)
    safetyAdvice: {
        alcohol: SafetyAdviceSchema,
        pregnancy: SafetyAdviceSchema,
        breastfeeding: SafetyAdviceSchema,
        driving: SafetyAdviceSchema,
        kidney: SafetyAdviceSchema,
        liver: SafetyAdviceSchema
    },

    missedDose: String,

    substitutes: [SubstituteSchema],

    quickTips: [String],

    factBox: {
        habitForming: mongoose.Schema.Types.Mixed, // Can be boolean or string "Unknown"
        therapeuticClass: String
    },

    patientConcerns: [String],

    faqs: [FAQSchema],

    manufacturerDetails: String,

    // Metadata
    lastUpdated: { type: Date, default: Date.now }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Create index on URL for fast upserts
MedicineSchema.index({ url: 1 });

export default mongoose.model('Medicine', MedicineSchema);

import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const accountRole = pgEnum("account_role", ["FREELANCER", "CLIENT"]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auth_id: text("auth_id").notNull().unique(),
    email: text("email").notNull(),
    role: accountRole().default("CLIENT").notNull(),
    identityVerification: boolean("identityVerified").default(false),
    paymentMethodVerified: boolean("paymentMethodVerified").default(false),
    isOnboardingComplete: boolean("isOnboardingComplete").default(false),
    created_at: timestamp("created_at", { withTimezone: true }),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
);

export const client_metadata = pgTable("client_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  auth_id: text("auth_id").notNull().unique(),
  role: text("role").notNull(),
  company_name: text("company_name").notNull(),
  company_website: text("company_website").notNull(),
  company_size: text("company_size").notNull(),
  industry: text("industry").notNull(),
  company_description: text("company_description").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }),
  updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const freelancer_metadata = pgTable("freelancer_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  auth_id: text("auth_id").notNull().unique(),
  professional_title: text("professional_title").notNull(),
  professional_description: text("professional_description").notNull(),
  hourly_rate: numeric("hourly_rate", {
    precision: 6,
    scale: 2,
  }).notNull(),
  country: text("country").notNull(),
  city: text("city").notNull(),
  availability_status: text("availability_status")
    .notNull()
    .default("AVAILABLE"),
  weekly_availability: text("weekly_availability").notNull(),
  experience_level: text("experience_level").notNull(),
  skills: text("skills").array().notNull().default([]),
  languages: jsonb("languages")
    .$type<Array<{ language: string; proficiency: string }>>()
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const freelancer_portfolios = pgTable("freelancer_portfolios", {
  id: uuid("id").defaultRandom().primaryKey(),
  freelancer_id: uuid("freelancer_id")
    .notNull()
    .references(() => freelancer_metadata.id, {
      onDelete: "cascade",
    }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  live_url: text("live_url"),
  cover_image: jsonb("cover_image")
    .$type<{ imageId: string; url: string }>()
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const freelancerMetadataRelations = relations(
  freelancer_metadata,
  ({ many }) => ({
    portfolios: many(freelancer_portfolios),
  }),
);

export const freelancerPortfolioRelations = relations(
  freelancer_portfolios,
  ({ one }) => ({
    freelancer: one(freelancer_metadata, {
      fields: [freelancer_portfolios.freelancer_id],
      references: [freelancer_metadata.id],
    }),
  }),
);

export const job_posts = pgTable("job_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  client_id: text("client_id")
    .notNull()
    .references(() => accounts.auth_id, {
      onDelete: "cascade",
    }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  expertise_level: text("expertise_level").notNull(),
  expected_duration: text("expected_duration").notNull(),
  skills: text("skills").array().notNull().default([]),

  total_budget: numeric("total_budget", {
    precision: 9,
    scale: 2,
  }).notNull(),

  milestones: jsonb("milestones")
    .$type<
      Array<{
        id: string;
        title: string;
        budget: number;
        dueDate: string;
      }>
    >()
    .notNull(),

  screening_questions: text("screening_questions").array().default([]),

  attachments: jsonb("attachments")
    .$type<
      Array<{
        fileId: string | undefined;
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
      }>
    >()
    .default([]),

  status: text("status").notNull().default("DRAFT"),

  published_at: timestamp("published_at", {
    withTimezone: true,
  }),

  hired_at: timestamp("hired_at", {
    withTimezone: true,
  }),

  created_at: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow(),

  updated_at: timestamp("updated_at", {
    withTimezone: true,
  }).defaultNow(),
});

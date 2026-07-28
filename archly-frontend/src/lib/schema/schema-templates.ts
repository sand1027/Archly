/**
 * Ready-made schema table templates + multi-table packs for Schema mode.
 */

import type { SchemaCardinality, SchemaColumn } from "@/types/schema";

export interface SchemaTableTemplate {
  id: string;
  name: string;
  label: string;
  hint: string;
  category: "core" | "auth" | "commerce" | "content" | "ops";
  columns: SchemaColumn[];
}

export interface SchemaPackRelation {
  from: string; // table template name
  to: string;
  cardinality: SchemaCardinality;
  label: string;
}

export interface SchemaPack {
  id: string;
  name: string;
  hint: string;
  /** AI prompt used when user clicks "Generate with AI" on this pack */
  aiPrompt: string;
  tables: SchemaTableTemplate[];
  relations: SchemaPackRelation[];
}

const idPk = (): SchemaColumn => ({
  name: "id",
  type: "uuid",
  pk: true,
  nullable: false,
});
const ts = (name = "created_at"): SchemaColumn => ({
  name,
  type: "timestamptz",
  nullable: false,
});
const updated = (): SchemaColumn => ({
  name: "updated_at",
  type: "timestamptz",
  nullable: false,
});

export const SCHEMA_TABLE_TEMPLATES: SchemaTableTemplate[] = [
  {
    id: "blank",
    name: "new_table",
    label: "Blank table",
    hint: "id + timestamps",
    category: "core",
    columns: [idPk(), ts(), updated()],
  },
  {
    id: "users",
    name: "users",
    label: "Users",
    hint: "Accounts & profiles",
    category: "auth",
    columns: [
      idPk(),
      { name: "email", type: "text", unique: true, nullable: false },
      { name: "password_hash", type: "text", nullable: true },
      { name: "display_name", type: "text", nullable: true },
      { name: "role", type: "text", nullable: false },
      { name: "is_active", type: "boolean", nullable: false },
      ts(),
      updated(),
    ],
  },
  {
    id: "sessions",
    name: "sessions",
    label: "Sessions",
    hint: "Auth sessions / refresh tokens",
    category: "auth",
    columns: [
      idPk(),
      { name: "user_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: false },
      { name: "token_hash", type: "text", unique: true, nullable: false },
      { name: "expires_at", type: "timestamptz", nullable: false },
      { name: "ip", type: "text", nullable: true },
      { name: "user_agent", type: "text", nullable: true },
      ts(),
    ],
  },
  {
    id: "organizations",
    name: "organizations",
    label: "Organizations",
    hint: "Multi-tenant orgs",
    category: "auth",
    columns: [
      idPk(),
      { name: "name", type: "text", nullable: false },
      { name: "slug", type: "text", unique: true, nullable: false },
      { name: "plan", type: "text", nullable: false },
      ts(),
      updated(),
    ],
  },
  {
    id: "memberships",
    name: "memberships",
    label: "Memberships",
    hint: "User ↔ org join",
    category: "auth",
    columns: [
      idPk(),
      { name: "org_id", type: "uuid", fk: { table: "organizations", column: "id" }, nullable: false },
      { name: "user_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: false },
      { name: "role", type: "text", nullable: false },
      ts(),
    ],
  },
  {
    id: "products",
    name: "products",
    label: "Products",
    hint: "Catalog items",
    category: "commerce",
    columns: [
      idPk(),
      { name: "sku", type: "text", unique: true, nullable: false },
      { name: "name", type: "text", nullable: false },
      { name: "description", type: "text", nullable: true },
      { name: "price_cents", type: "bigint", nullable: false },
      { name: "currency", type: "text", nullable: false },
      { name: "is_active", type: "boolean", nullable: false },
      ts(),
      updated(),
    ],
  },
  {
    id: "orders",
    name: "orders",
    label: "Orders",
    hint: "Checkout orders",
    category: "commerce",
    columns: [
      idPk(),
      { name: "user_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "total_cents", type: "bigint", nullable: false },
      { name: "currency", type: "text", nullable: false },
      ts(),
      updated(),
    ],
  },
  {
    id: "order_items",
    name: "order_items",
    label: "Order items",
    hint: "Line items",
    category: "commerce",
    columns: [
      idPk(),
      { name: "order_id", type: "uuid", fk: { table: "orders", column: "id" }, nullable: false },
      { name: "product_id", type: "uuid", fk: { table: "products", column: "id" }, nullable: false },
      { name: "quantity", type: "int", nullable: false },
      { name: "unit_price_cents", type: "bigint", nullable: false },
    ],
  },
  {
    id: "payments",
    name: "payments",
    label: "Payments",
    hint: "Charges & captures",
    category: "commerce",
    columns: [
      idPk(),
      { name: "order_id", type: "uuid", fk: { table: "orders", column: "id" }, nullable: false },
      { name: "provider", type: "text", nullable: false },
      { name: "provider_ref", type: "text", unique: true, nullable: true },
      { name: "amount_cents", type: "bigint", nullable: false },
      { name: "status", type: "text", nullable: false },
      ts(),
    ],
  },
  {
    id: "courses",
    name: "courses",
    label: "Courses",
    hint: "Edtech courses",
    category: "content",
    columns: [
      idPk(),
      { name: "educator_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "slug", type: "text", unique: true, nullable: false },
      { name: "level", type: "text", nullable: true },
      { name: "is_published", type: "boolean", nullable: false },
      ts(),
      updated(),
    ],
  },
  {
    id: "enrollments",
    name: "enrollments",
    label: "Enrollments",
    hint: "Student ↔ course",
    category: "content",
    columns: [
      idPk(),
      { name: "user_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: false },
      { name: "course_id", type: "uuid", fk: { table: "courses", column: "id" }, nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "progress_pct", type: "int", nullable: false },
      ts(),
    ],
  },
  {
    id: "lessons",
    name: "lessons",
    label: "Lessons",
    hint: "Course content units",
    category: "content",
    columns: [
      idPk(),
      { name: "course_id", type: "uuid", fk: { table: "courses", column: "id" }, nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "position", type: "int", nullable: false },
      { name: "video_url", type: "text", nullable: true },
      { name: "duration_sec", type: "int", nullable: true },
      ts(),
    ],
  },
  {
    id: "posts",
    name: "posts",
    label: "Posts",
    hint: "Blog / feed posts",
    category: "content",
    columns: [
      idPk(),
      { name: "author_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "body", type: "text", nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "published_at", type: "timestamptz", nullable: true },
      ts(),
      updated(),
    ],
  },
  {
    id: "notifications",
    name: "notifications",
    label: "Notifications",
    hint: "In-app alerts",
    category: "ops",
    columns: [
      idPk(),
      { name: "user_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: false },
      { name: "channel", type: "text", nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "body", type: "text", nullable: true },
      { name: "read_at", type: "timestamptz", nullable: true },
      ts(),
    ],
  },
  {
    id: "audit_logs",
    name: "audit_logs",
    label: "Audit logs",
    hint: "Security / change trail",
    category: "ops",
    columns: [
      idPk(),
      { name: "actor_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: true },
      { name: "action", type: "text", nullable: false },
      { name: "entity_type", type: "text", nullable: false },
      { name: "entity_id", type: "uuid", nullable: true },
      { name: "meta", type: "jsonb", nullable: true },
      ts(),
    ],
  },
  {
    id: "files",
    name: "files",
    label: "Files",
    hint: "Uploads / object refs",
    category: "ops",
    columns: [
      idPk(),
      { name: "owner_id", type: "uuid", fk: { table: "users", column: "id" }, nullable: false },
      { name: "bucket", type: "text", nullable: false },
      { name: "object_key", type: "text", nullable: false },
      { name: "mime_type", type: "text", nullable: true },
      { name: "size_bytes", type: "bigint", nullable: true },
      ts(),
    ],
  },
];

function tpl(id: string): SchemaTableTemplate {
  const t = SCHEMA_TABLE_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template ${id}`);
  return t;
}

export const SCHEMA_PACKS: SchemaPack[] = [
  {
    id: "auth",
    name: "Auth starter",
    hint: "users · sessions · orgs · memberships",
    aiPrompt:
      "Design production auth and multi-tenant database schema with 30–40 tables including roles, invites, and audit_logs",
    tables: [tpl("users"), tpl("sessions"), tpl("organizations"), tpl("memberships")],
    relations: [
      { from: "users", to: "sessions", cardinality: "1:N", label: "has" },
      { from: "organizations", to: "memberships", cardinality: "1:N", label: "has" },
      { from: "users", to: "memberships", cardinality: "1:N", label: "joins" },
    ],
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    hint: "users · products · orders · payments",
    aiPrompt:
      "Design production e-commerce database schema with catalog, cart, orders, payments, inventory, and audit (30–40 tables)",
    tables: [tpl("users"), tpl("products"), tpl("orders"), tpl("order_items"), tpl("payments")],
    relations: [
      { from: "users", to: "orders", cardinality: "1:N", label: "places" },
      { from: "orders", to: "order_items", cardinality: "1:N", label: "contains" },
      { from: "products", to: "order_items", cardinality: "1:N", label: "sold_as" },
      { from: "orders", to: "payments", cardinality: "1:N", label: "paid_by" },
    ],
  },
  {
    id: "edtech",
    name: "Edtech / Unacademy",
    hint: "users · courses · lessons · enrollments",
    aiPrompt:
      "Design Unacademy full production database schema with auth, courses, lessons, enrollments, payments, and audit (30–40 tables)",
    tables: [tpl("users"), tpl("courses"), tpl("lessons"), tpl("enrollments"), tpl("payments")],
    relations: [
      { from: "users", to: "courses", cardinality: "1:N", label: "teaches" },
      { from: "courses", to: "lessons", cardinality: "1:N", label: "has" },
      { from: "users", to: "enrollments", cardinality: "1:N", label: "enrolls" },
      { from: "courses", to: "enrollments", cardinality: "1:N", label: "has" },
    ],
  },
  {
    id: "saas",
    name: "SaaS billing",
    hint: "orgs · members · products · payments",
    aiPrompt:
      "Design multi-tenant SaaS production database schema with orgs, billing, subscriptions, and audit (30–40 tables)",
    tables: [tpl("organizations"), tpl("memberships"), tpl("users"), tpl("products"), tpl("payments")],
    relations: [
      { from: "organizations", to: "memberships", cardinality: "1:N", label: "has" },
      { from: "users", to: "memberships", cardinality: "1:N", label: "joins" },
      { from: "organizations", to: "payments", cardinality: "1:N", label: "billed" },
    ],
  },
];

export const SCHEMA_CATEGORY_LABELS: Record<SchemaTableTemplate["category"], string> = {
  core: "Core",
  auth: "Auth & tenants",
  commerce: "Commerce",
  content: "Content",
  ops: "Ops & files",
};

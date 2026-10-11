/**
 * Who is legally responsible for SYCRAS. Fill these in once there is an open
 * activity (sole trader) or a company, then set `ready: true`: the terms and
 * privacy pages become linked across the app and indexable.
 */
export const LEGAL = {
  ready: false,
  /** Full name (sole trader) or company name, e.g. "SYCRAS, Unipessoal Lda". */
  entity: null as string | null,
  /** NIF / NIPC. */
  nif: null as string | null,
  /** Registered (fiscal) address. */
  address: null as string | null,
  /** Contact for legal and privacy requests. */
  email: "privacidade@sycras.com" as string | null,
  /** Last time the texts changed (shown on the pages). */
  updated: "11 de outubro de 2026",
};

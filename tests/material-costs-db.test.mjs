import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("cost migration: transactions, permissions, revisions and daily prices", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;
      alter default privileges in schema public grant all on tables to authenticated;
      alter default privileges in schema public grant all on sequences to authenticated;
    `);
    for (const name of (
      await readdir(new URL("../supabase/migrations/", import.meta.url))
    )
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    }
    const admin = randomUUID(),
      operator = randomUUID(),
      inactive = randomUUID();
    await db.query("insert into auth.users(id) values ($1),($2),($3)", [
      admin,
      operator,
      inactive,
    ]);
    await db.query("update public.profiles set role='admin' where id=$1", [
      admin,
    ]);
    await db.query("update public.profiles set active=false where id=$1", [
      inactive,
    ]);
    const material = randomUUID();
    await db.query(
      "insert into public.materials(id,code,name,unit_of_measure) values ($1,'TEST-PE','PEAD','kg')",
      [material],
    );
    const location = (
      await db.query("select id from public.locations where code='BOD-01'")
    ).rows[0].id;
    const today = (
      await db.query(
        "select (now() at time zone 'America/Bogota')::date::text as day",
      )
    ).rows[0].day;
    async function asUser(id, role = "authenticated") {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id ?? "",
      ]);
      await db.exec(`set role ${role}`);
    }
    const cost = {
      purchase_date: today,
      supplier: "Proveedor",
      invoice: "FACT-1",
      shipment: "CONT-1",
      currency: "COP",
      exchange_rate: 1,
      unit_price: 3900,
      discount: 0,
      freight: 240000,
      insurance: 0,
      duties: 0,
      other_costs: 0,
      recoverable_tax: 100000,
      allocation_note: "Flete íntegro: contenedor de un solo material",
      status: "confirmed",
      reason: "Registro de compra",
    };
    const receipt = {
      material_id: material,
      to_location_id: location,
      lot_code: "TEST-LOT",
      quantity: 24000,
    };
    const requestId = randomUUID();
    await asUser(admin);
    let movementId;
    await t.test(
      "purchase stores inventory and cost atomically; retries are idempotent",
      async () => {
        const query =
          "select public.create_costed_material_purchase($1,$2,$3) as id";
        movementId = (await db.query(query, [requestId, receipt, cost])).rows[0]
          .id;
        assert.equal(
          (await db.query(query, [requestId, receipt, cost])).rows[0].id,
          movementId,
        );
        const rows = (
          await db.query(
            "select * from public.material_cost_revisions where movement_id=$1",
            [movementId],
          )
        ).rows;
        assert.equal(rows.length, 1);
        assert.equal(Number(rows[0].total_cop), 93840000);
        assert.equal(Number(rows[0].recoverable_tax), 100000);
      },
    );
    await t.test("invalid price rolls back the receipt and lot", async () => {
      await assert.rejects(
        db.query("select public.create_costed_material_purchase($1,$2,$3)", [
          randomUUID(),
          { ...receipt, lot_code: "BAD-LOT" },
          { ...cost, unit_price: -1 },
        ]),
      );
      assert.equal(
        (
          await db.query(
            "select id from public.material_lots where lot_code='BAD-LOT'",
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select id from public.inventory_movements")).rows
          .length,
        1,
      );
    });
    await t.test(
      "corrections append history and stale revisions are rejected",
      async () => {
        await db.query("select public.save_material_cost($1,1,$2)", [
          movementId,
          { ...cost, freight: 480000, reason: "Flete final confirmado" },
        ]);
        await assert.rejects(
          db.query("select public.save_material_cost($1,1,$2)", [
            movementId,
            cost,
          ]),
          /cambió/,
        );
        assert.equal(
          (
            await db.query(
              "select id from public.material_cost_revisions where movement_id=$1",
              [movementId],
            )
          ).rows.length,
          2,
        );
        await assert.rejects(
          db.query("update public.material_cost_revisions set unit_price=1"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "foreign currency and invalid discount validation occurs in database",
      async () => {
        await assert.rejects(
          db.query("select public.save_material_cost($1,2,$2)", [
            movementId,
            { ...cost, exchange_rate: 4000 },
          ]),
          /check constraint/,
        );
        await assert.rejects(
          db.query("select public.save_material_cost($1,2,$2)", [
            movementId,
            { ...cost, discount: 24000 * 3900 },
          ]),
          /descuento/,
        );
        await assert.rejects(
          db.query("select public.save_material_cost($1,2,$2)", [
            movementId,
            { ...cost, allocation_note: "" },
          ]),
          /asignaron/,
        );
      },
    );
    await t.test(
      "operator can enter quantities and price in one daily register",
      async () => {
        await asUser(operator);
        await db.query(
          "select public.create_daily_inventory_register($1,$2,$3,$4,$5)",
          [
            location,
            today,
            "Operario",
            "",
            [{ material_id: material, entry: 2900, exit: 0, unit_price: 5000 }],
          ],
        );
        await assert.rejects(
          db.query("select public.material_cost_snapshot()"),
          /permiso/,
        );
        assert.equal(
          (await db.query("select * from public.material_cost_revisions")).rows
            .length,
          0,
        );
        await assert.rejects(
          db.query("select public.save_material_cost($1,2,$2)", [
            movementId,
            cost,
          ]),
          /permiso/,
        );
        await assert.rejects(
          db.query("select public.record_entry_price($1,1,$2)", [
            movementId,
            today,
          ]),
          /propias/,
        );
        await asUser(admin);
        const snapshot = (
          await db.query("select public.material_cost_snapshot() as data")
        ).rows[0].data;
        assert.equal(snapshot.movements.length, 2);
        assert.equal(snapshot.costs.length, 2);
        const simple = snapshot.costs.find((c) => c.movement_id !== movementId);
        assert.equal(Number(simple.total_cop), 14500000);
        assert.equal(simple.status, "provisional");
      },
    );
    await t.test(
      "missing price rolls back daily entry; exit-only needs no price",
      async () => {
        await asUser(operator);
        await assert.rejects(
          db.query(
            "select public.create_daily_inventory_register($1,$2,$3,$4,$5)",
            [
              location,
              today,
              "Operario",
              "",
              [{ material_id: material, entry: 20, exit: 0 }],
            ],
          ),
          /precio/,
        );
        await db.query(
          "select public.create_daily_inventory_register($1,$2,$3,$4,$5)",
          [
            location,
            today,
            "Operario",
            "",
            [{ material_id: material, entry: 0, exit: 10 }],
          ],
        );
        await asUser(admin);
        assert.equal(
          (
            await db.query(
              "select id from public.inventory_movements where movement_type='entrada'",
            )
          ).rows.length,
          2,
        );
      },
    );
    await t.test(
      "inactive and anonymous users cannot access financial RPCs",
      async () => {
        await asUser(inactive);
        await assert.rejects(
          db.query("select public.material_cost_snapshot()"),
          /permiso/,
        );
        await asUser(null, "anon");
        await assert.rejects(
          db.query("select public.material_cost_snapshot()"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select * from public.material_cost_revisions"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "canceled movements cannot receive a new cost revision",
      async () => {
        await db.exec("reset role");
        await db.query(
          "update public.inventory_movements set cancelled_at=now() where id=$1",
          [movementId],
        );
        await asUser(admin);
        await assert.rejects(
          db.query("select public.save_material_cost($1,2,$2)", [
            movementId,
            cost,
          ]),
          /cancelada/,
        );
      },
    );
    await t.test(
      "daily request prevents duplicate inventory and detects changed retries",
      async () => {
        await asUser(operator);
        const query =
          "select public.create_priced_daily_inventory_register($1,$2,$3,$4,$5,$6) as count";
        const args = [
          randomUUID(),
          location,
          today,
          "Operario",
          "",
          [{ material_id: material, entry: 1, exit: 0, unit_price: 3900 }],
        ];
        assert.equal((await db.query(query, args)).rows[0].count, 1);
        assert.equal((await db.query(query, args)).rows[0].count, 1);
        await assert.rejects(
          db.query(query, [
            ...args.slice(0, 5),
            [{ material_id: material, entry: 2, exit: 0, unit_price: 3900 }],
          ]),
          /ya fue guardada/,
        );
      },
    );
  } finally {
    await db.close();
  }
});

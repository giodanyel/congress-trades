-- Phase 3: stocks + trades tables, real historical Senate STOCK Act data
-- Source: senate-stock-watcher-data (efdsearch.senate.gov filings)

create type trade_type as enum ('PURCHASE', 'SALE', 'EXCHANGE');
create type owner_type as enum ('SELF', 'SPOUSE', 'JOINT', 'CHILD');

create table stocks (
  ticker text primary key,
  company_name text not null,
  created_at timestamptz not null default now()
);

create table trades (
  id text primary key default gen_random_uuid()::text,
  politician_id text not null references politicians(id) on delete cascade,
  ticker text not null references stocks(ticker),
  trade_type trade_type not null,
  owner owner_type not null default 'SELF',
  transaction_date date not null,
  amount_min numeric,
  amount_max numeric,
  amount_label text,
  source_url text,
  created_at timestamptz not null default now()
);

create index idx_trades_politician on trades(politician_id);
create index idx_trades_ticker on trades(ticker);
create index idx_trades_date on trades(transaction_date);

alter table politicians add constraint politicians_full_name_key unique (full_name);

-- New senators found in the trade data
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Sheldon', 'Whitehouse', 'Sheldon Whitehouse', 'DEMOCRAT', 'RI', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Susan', 'Collins', 'Susan Collins', 'REPUBLICAN', 'ME', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Shelley', 'Capito', 'Shelley Moore Capito', 'REPUBLICAN', 'WV', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Ron', 'Wyden', 'Ron Wyden', 'DEMOCRAT', 'OR', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Patty', 'Murray', 'Patty Murray', 'DEMOCRAT', 'WA', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Bill', 'Cassidy', 'Bill Cassidy', 'REPUBLICAN', 'LA', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Gary', 'Peters', 'Gary Peters', 'DEMOCRAT', 'MI', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Thom', 'Tillis', 'Thom Tillis', 'REPUBLICAN', 'NC', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Angus', 'King', 'Angus King', 'INDEPENDENT', 'ME', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Mark', 'Warner', 'Mark Warner', 'DEMOCRAT', 'VA', 'SENATE', '{}') on conflict (full_name) do nothing;
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees) values ('Tina', 'Smith', 'Tina Smith', 'DEMOCRAT', 'MN', 'SENATE', '{}') on conflict (full_name) do nothing;

-- Stocks
insert into stocks (ticker, company_name) values ('BYND', 'Beyond Meat, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('NVDA', 'NVIDIA Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WDAY', 'Workday, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('AMZN', 'Amazon.com, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('F', 'Ford Motor Company') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('T', 'AT&amp;T Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('TSLA', 'Tesla, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('BMY', 'Bristol-Myers Squibb Company') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('ILMN', 'Illumina, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('AAPL', 'Apple Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WMT', 'Walmart Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('SBUX', 'Starbucks Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('PG', 'The Procter &amp; Gamble Company') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('NVS', 'Novartis AG') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('JPM', 'JPMorgan Chase &amp; Co.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('MSFT', 'Microsoft Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('KMI', 'Kinder Morgan, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('SLB', 'Schlumberger Limited') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('COP', 'ConocoPhillips') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('RYN', 'Rayonier Inc. (NYSE)') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('CSCO', 'Cisco Systems, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('GDDY', 'GoDaddy Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('CSX', 'CSX Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('ENB', 'Enbridge Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('SGAPY', 'Singapore Telecommunications Limited') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('SSDOY', 'Shiseido Company, Limited') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('CMCSA', 'Comcast Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('MSTY.PA', 'Mainstay Medical International plc') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('PODD', 'Insulet Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('CUTR', 'Cutera, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('IIN', 'IntriCon Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('SPG', 'Simon Property Group, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('TFC', 'BB&amp;T CORP (Exchanged) <br> Truist Financial Corporation (Received)') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('CVS', 'CVS Health Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('MAT', 'Mattel, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('ARCC', 'Ares Capital Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('GIS', 'General Mills, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('GE', 'General Electric Company') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('PRGO', 'Perrigo Company plc') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('LIN', 'Linde plc') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('FB', 'Facebook, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('XOM', 'Exxon Mobil Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('CFR', 'Cullen/Frost Bankers, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('HALO', 'Halozyme Therapeutics, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('XON', 'Intrexon Corporation') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('ZIOP', 'ZIOPHARM Oncology, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('ZAYO', 'Zayo Group Holdings, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('CHTR', 'Charter Communications, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('JCOM', 'j2 Global, Inc. (NASDAQ)') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WST', 'West Pharmaceutical Services, Inc. (NYSE)') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WAL', 'Western Alliance Bancorporation (NYSE)') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WAGE', 'WageWorks, Inc. (NYSE)') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('VSI', 'Vitamin Shoppe, Inc. (NYSE)') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('TYPE', 'Monotype Imaging Holdings Inc. (NASDAQ)') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WMB', 'The Williams Companies, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WRK', 'WestRock Company') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WFC', 'Wells Fargo &amp; Company') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('WBA', 'Walgreens Boots Alliance, Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('VZ', 'Verizon Communications Inc.') on conflict (ticker) do nothing;
insert into stocks (ticker, company_name) values ('VTR', 'Ventas, Inc.') on conflict (ticker) do nothing;

-- Trades
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'BYND', 'SALE', 'SPOUSE', '2020-11-10', 50001, 100000, '$50,001 - $100,000', 'https://efdsearch.senate.gov/search/view/ptr/a0010f4a-c31a-4824-8b6d-6399b3ccb6f0/' from politicians where full_name = 'Ron Wyden';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'NVDA', 'PURCHASE', 'CHILD', '2020-10-16', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/4e013e86-56bf-4a73-90ea-d7badba4ac9b/' from politicians where full_name = 'Ron Wyden';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WDAY', 'PURCHASE', 'CHILD', '2020-10-16', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/4e013e86-56bf-4a73-90ea-d7badba4ac9b/' from politicians where full_name = 'Ron Wyden';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'NVDA', 'PURCHASE', 'CHILD', '2020-10-16', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/4e013e86-56bf-4a73-90ea-d7badba4ac9b/' from politicians where full_name = 'Ron Wyden';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WDAY', 'PURCHASE', 'CHILD', '2020-10-16', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/4e013e86-56bf-4a73-90ea-d7badba4ac9b/' from politicians where full_name = 'Ron Wyden';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'NVDA', 'PURCHASE', 'CHILD', '2020-10-16', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/4e013e86-56bf-4a73-90ea-d7badba4ac9b/' from politicians where full_name = 'Ron Wyden';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WDAY', 'PURCHASE', 'CHILD', '2020-10-16', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/4e013e86-56bf-4a73-90ea-d7badba4ac9b/' from politicians where full_name = 'Ron Wyden';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'AMZN', 'PURCHASE', 'JOINT', '2018-12-28', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/a22bbeeb-0e4f-4993-89e2-ed28ba9f6242/' from politicians where full_name = 'Sheldon Whitehouse';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'F', 'SALE', 'JOINT', '2018-12-28', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/a22bbeeb-0e4f-4993-89e2-ed28ba9f6242/' from politicians where full_name = 'Sheldon Whitehouse';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'NVDA', 'PURCHASE', 'JOINT', '2018-12-28', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/a22bbeeb-0e4f-4993-89e2-ed28ba9f6242/' from politicians where full_name = 'Sheldon Whitehouse';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'T', 'SALE', 'JOINT', '2018-12-28', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/a22bbeeb-0e4f-4993-89e2-ed28ba9f6242/' from politicians where full_name = 'Sheldon Whitehouse';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'TSLA', 'PURCHASE', 'JOINT', '2018-12-28', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/a22bbeeb-0e4f-4993-89e2-ed28ba9f6242/' from politicians where full_name = 'Sheldon Whitehouse';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'BMY', 'SALE', 'JOINT', '2018-12-28', 15001, 50000, '$15,001 - $50,000', 'https://efdsearch.senate.gov/search/view/ptr/a22bbeeb-0e4f-4993-89e2-ed28ba9f6242/' from politicians where full_name = 'Sheldon Whitehouse';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'ILMN', 'PURCHASE', 'SELF', '2018-12-28', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/a22bbeeb-0e4f-4993-89e2-ed28ba9f6242/' from politicians where full_name = 'Sheldon Whitehouse';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'AAPL', 'SALE', 'SPOUSE', '2017-12-29', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/a2f3bcb0-5afa-4c17-99fd-885e3abdf963/' from politicians where full_name = 'Bill Cassidy';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WMT', 'SALE', 'SPOUSE', '2018-12-07', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/aea94c0d-f18b-4ab7-bdac-95a0f3f04339/' from politicians where full_name = 'Bill Cassidy';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'SBUX', 'SALE', 'SPOUSE', '2018-12-07', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/aea94c0d-f18b-4ab7-bdac-95a0f3f04339/' from politicians where full_name = 'Bill Cassidy';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'PG', 'SALE', 'SPOUSE', '2018-12-07', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/aea94c0d-f18b-4ab7-bdac-95a0f3f04339/' from politicians where full_name = 'Bill Cassidy';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'NVS', 'SALE', 'SPOUSE', '2018-12-07', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/aea94c0d-f18b-4ab7-bdac-95a0f3f04339/' from politicians where full_name = 'Bill Cassidy';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'JPM', 'PURCHASE', 'SPOUSE', '2018-12-07', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/aea94c0d-f18b-4ab7-bdac-95a0f3f04339/' from politicians where full_name = 'Bill Cassidy';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'MSFT', 'SALE', 'SPOUSE', '2018-12-07', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/aea94c0d-f18b-4ab7-bdac-95a0f3f04339/' from politicians where full_name = 'Bill Cassidy';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'KMI', 'SALE', 'SPOUSE', '2015-12-16', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/5cae926b-a941-4bc9-9a06-df2a6452da46/' from politicians where full_name = 'Angus King';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'SLB', 'PURCHASE', 'SPOUSE', '2017-11-28', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/8c37c970-7a72-4821-b02d-bbaef57875dd/' from politicians where full_name = 'Angus King';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'COP', 'PURCHASE', 'SPOUSE', '2017-11-28', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/8c37c970-7a72-4821-b02d-bbaef57875dd/' from politicians where full_name = 'Angus King';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'PG', 'SALE', 'SPOUSE', '2017-11-17', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/8c37c970-7a72-4821-b02d-bbaef57875dd/' from politicians where full_name = 'Angus King';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'NVS', 'SALE', 'SPOUSE', '2017-11-10', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/8c37c970-7a72-4821-b02d-bbaef57875dd/' from politicians where full_name = 'Angus King';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'RYN', 'SALE', 'SPOUSE', '2014-11-10', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/c57b3fd9-3bbd-4f31-8904-9a517aaf43d9/' from politicians where full_name = 'Angus King';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CSCO', 'SALE', 'SPOUSE', '2017-10-19', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/32bf0111-becd-47e8-bc3d-74caf0bd364a/' from politicians where full_name = 'Angus King';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'GDDY', 'PURCHASE', 'SPOUSE', '2017-12-20', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/ad988790-1a7b-4142-b095-2fae9a09276e/' from politicians where full_name = 'Shelley Moore Capito';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CSX', 'PURCHASE', 'SPOUSE', '2017-12-20', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/ad988790-1a7b-4142-b095-2fae9a09276e/' from politicians where full_name = 'Shelley Moore Capito';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'ENB', 'PURCHASE', 'SPOUSE', '2017-12-19', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/ad988790-1a7b-4142-b095-2fae9a09276e/' from politicians where full_name = 'Shelley Moore Capito';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'SGAPY', 'SALE', 'SPOUSE', '2017-12-19', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/ad988790-1a7b-4142-b095-2fae9a09276e/' from politicians where full_name = 'Shelley Moore Capito';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'SSDOY', 'SALE', 'SPOUSE', '2017-12-19', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/ad988790-1a7b-4142-b095-2fae9a09276e/' from politicians where full_name = 'Shelley Moore Capito';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CMCSA', 'PURCHASE', 'SPOUSE', '2019-12-16', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/d4a14e34-0f09-44e3-b00e-75aa1c12bca7/' from politicians where full_name = 'Shelley Moore Capito';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'PG', 'PURCHASE', 'SPOUSE', '2018-12-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/ac9882e2-ebad-4128-93f6-d8ea9427314d/' from politicians where full_name = 'Shelley Moore Capito';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'MSTY.PA', 'PURCHASE', 'SPOUSE', '2018-10-30', 50001, 100000, '$50,001 - $100,000', 'https://efdsearch.senate.gov/search/view/ptr/f02241a5-ba65-429f-ab64-3d97674f8e77/' from politicians where full_name = 'Tina Smith';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'MSTY.PA', 'PURCHASE', 'SPOUSE', '2018-10-29', 50001, 100000, '$50,001 - $100,000', 'https://efdsearch.senate.gov/search/view/ptr/f02241a5-ba65-429f-ab64-3d97674f8e77/' from politicians where full_name = 'Tina Smith';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'PODD', 'SALE', 'SPOUSE', '2018-08-30', 15001, 50000, '$15,001 - $50,000', 'https://efdsearch.senate.gov/search/view/ptr/2235b033-9cb7-43af-8e69-d55ce1a23561/' from politicians where full_name = 'Tina Smith';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CUTR', 'SALE', 'SPOUSE', '2018-08-30', 100001, 250000, '$100,001 - $250,000', 'https://efdsearch.senate.gov/search/view/ptr/2235b033-9cb7-43af-8e69-d55ce1a23561/' from politicians where full_name = 'Tina Smith';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CUTR', 'SALE', 'SPOUSE', '2018-08-30', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/2235b033-9cb7-43af-8e69-d55ce1a23561/' from politicians where full_name = 'Tina Smith';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'PODD', 'SALE', 'JOINT', '2018-08-30', 250001, 500000, '$250,001 - $500,000', 'https://efdsearch.senate.gov/search/view/ptr/2235b033-9cb7-43af-8e69-d55ce1a23561/' from politicians where full_name = 'Tina Smith';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'IIN', 'SALE', 'SPOUSE', '2018-07-26', 100001, 250000, '$100,001 - $250,000', 'https://efdsearch.senate.gov/search/view/ptr/b5aa283c-4a0b-44f2-8571-e68bf04c6984/' from politicians where full_name = 'Tina Smith';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'SPG', 'PURCHASE', 'SELF', '2016-12-30', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/94c8e45b-640f-46dc-8cd9-d96edc20e67a/' from politicians where full_name = 'Gary Peters';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'TFC', 'EXCHANGE', 'SELF', '2019-12-06', 15001, 50000, '$15,001 - $50,000', 'https://efdsearch.senate.gov/search/view/ptr/b4f5da30-40c3-4b8c-a01b-91c5ec512773/' from politicians where full_name = 'Gary Peters';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CVS', 'PURCHASE', 'SELF', '2016-11-30', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/a1acf60e-03f1-4e23-b9e3-3ac6b7dc1f6f/' from politicians where full_name = 'Gary Peters';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'MAT', 'SALE', 'SELF', '2017-11-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/efb93782-9a75-4cf1-863d-dcf5bd899c65/' from politicians where full_name = 'Gary Peters';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'ARCC', 'PURCHASE', 'SELF', '2017-11-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/efb93782-9a75-4cf1-863d-dcf5bd899c65/' from politicians where full_name = 'Gary Peters';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'GIS', 'PURCHASE', 'SELF', '2018-11-09', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bbd1f7c0-aefc-4f68-b5c1-d7fe1310b2c0/' from politicians where full_name = 'Gary Peters';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'GE', 'SALE', 'SELF', '2018-10-30', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bbd1f7c0-aefc-4f68-b5c1-d7fe1310b2c0/' from politicians where full_name = 'Gary Peters';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'PRGO', 'PURCHASE', 'SPOUSE', '2016-12-30', 15001, 50000, '$15,001 - $50,000', 'https://efdsearch.senate.gov/search/view/ptr/e373cb0c-9dae-4a6b-8c6f-f29374a271ac/' from politicians where full_name = 'Susan Collins';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'COP', 'PURCHASE', 'SPOUSE', '2016-12-30', 15001, 50000, '$15,001 - $50,000', 'https://efdsearch.senate.gov/search/view/ptr/e373cb0c-9dae-4a6b-8c6f-f29374a271ac/' from politicians where full_name = 'Susan Collins';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'LIN', 'SALE', 'SPOUSE', '2018-12-21', 15001, 50000, '$15,001 - $50,000', 'https://efdsearch.senate.gov/search/view/ptr/bb3e64d2-1a93-46ac-ac1d-47508fbb199f/' from politicians where full_name = 'Susan Collins';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'FB', 'SALE', 'SPOUSE', '2018-12-21', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bb3e64d2-1a93-46ac-ac1d-47508fbb199f/' from politicians where full_name = 'Susan Collins';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'XOM', 'SALE', 'SPOUSE', '2018-12-21', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bb3e64d2-1a93-46ac-ac1d-47508fbb199f/' from politicians where full_name = 'Susan Collins';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'ENB', 'SALE', 'SPOUSE', '2018-12-21', 15001, 50000, '$15,001 - $50,000', 'https://efdsearch.senate.gov/search/view/ptr/bb3e64d2-1a93-46ac-ac1d-47508fbb199f/' from politicians where full_name = 'Susan Collins';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CFR', 'SALE', 'SPOUSE', '2018-12-21', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bb3e64d2-1a93-46ac-ac1d-47508fbb199f/' from politicians where full_name = 'Susan Collins';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'HALO', 'SALE', 'SELF', '2017-11-06', 500001, 1000000, '$500,001 - $1,000,000', 'https://efdsearch.senate.gov/search/view/ptr/d94f6136-fd12-4105-910f-6f52c771faee/' from politicians where full_name = 'Mark Warner';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'XON', 'SALE', 'SELF', '2017-10-18', 1000001, 5000000, '$1,000,001 - $5,000,000', 'https://efdsearch.senate.gov/search/view/ptr/e0a8aa1c-11b5-45aa-baeb-9216b60b0e5d/' from politicians where full_name = 'Mark Warner';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'ZIOP', 'SALE', 'SELF', '2017-10-18', 250001, 500000, '$250,001 - $500,000', 'https://efdsearch.senate.gov/search/view/ptr/e0a8aa1c-11b5-45aa-baeb-9216b60b0e5d/' from politicians where full_name = 'Mark Warner';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'ZAYO', 'SALE', 'SELF', '2019-02-20', 250001, 500000, '$250,001 - $500,000', 'https://efdsearch.senate.gov/search/view/ptr/c008dcd7-7a5e-46ee-9806-cf60a08a23dc/' from politicians where full_name = 'Mark Warner';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'ZAYO', 'SALE', 'SELF', '2019-02-19', 500001, 1000000, '$500,001 - $1,000,000', 'https://efdsearch.senate.gov/search/view/ptr/c008dcd7-7a5e-46ee-9806-cf60a08a23dc/' from politicians where full_name = 'Mark Warner';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CHTR', 'SALE', 'SELF', '2019-02-19', 1000001, 5000000, '$1,000,001 - $5,000,000', 'https://efdsearch.senate.gov/search/view/ptr/c008dcd7-7a5e-46ee-9806-cf60a08a23dc/' from politicians where full_name = 'Mark Warner';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'CVS', 'SALE', 'JOINT', '2018-12-20', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/44a21895-607d-48b6-89d9-0876caad796f/' from politicians where full_name = 'Thom Tillis';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'JCOM', 'SALE', 'JOINT', '2015-02-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bbdeaa6d-dcb6-41fa-a5d5-cb5e5d10af6b/' from politicians where full_name = 'Thom Tillis';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WST', 'SALE', 'JOINT', '2015-02-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bbdeaa6d-dcb6-41fa-a5d5-cb5e5d10af6b/' from politicians where full_name = 'Thom Tillis';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WAL', 'SALE', 'JOINT', '2015-02-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bbdeaa6d-dcb6-41fa-a5d5-cb5e5d10af6b/' from politicians where full_name = 'Thom Tillis';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WAGE', 'SALE', 'JOINT', '2015-02-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bbdeaa6d-dcb6-41fa-a5d5-cb5e5d10af6b/' from politicians where full_name = 'Thom Tillis';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'VSI', 'SALE', 'JOINT', '2015-02-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bbdeaa6d-dcb6-41fa-a5d5-cb5e5d10af6b/' from politicians where full_name = 'Thom Tillis';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'TYPE', 'SALE', 'JOINT', '2015-02-13', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/bbdeaa6d-dcb6-41fa-a5d5-cb5e5d10af6b/' from politicians where full_name = 'Thom Tillis';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WMB', 'SALE', 'SPOUSE', '2017-06-15', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/07a7470c-ae50-4a37-8c10-cf1c59a69674/' from politicians where full_name = 'Patty Murray';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WRK', 'SALE', 'SPOUSE', '2017-06-15', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/07a7470c-ae50-4a37-8c10-cf1c59a69674/' from politicians where full_name = 'Patty Murray';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WFC', 'SALE', 'SPOUSE', '2017-06-15', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/07a7470c-ae50-4a37-8c10-cf1c59a69674/' from politicians where full_name = 'Patty Murray';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WBA', 'SALE', 'SPOUSE', '2017-06-15', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/07a7470c-ae50-4a37-8c10-cf1c59a69674/' from politicians where full_name = 'Patty Murray';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'WMT', 'SALE', 'SPOUSE', '2017-06-15', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/07a7470c-ae50-4a37-8c10-cf1c59a69674/' from politicians where full_name = 'Patty Murray';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'VZ', 'SALE', 'SPOUSE', '2017-06-15', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/07a7470c-ae50-4a37-8c10-cf1c59a69674/' from politicians where full_name = 'Patty Murray';
insert into trades (politician_id, ticker, trade_type, owner, transaction_date, amount_min, amount_max, amount_label, source_url) select id, 'VTR', 'SALE', 'SPOUSE', '2017-06-15', 1001, 15000, '$1,001 - $15,000', 'https://efdsearch.senate.gov/search/view/ptr/07a7470c-ae50-4a37-8c10-cf1c59a69674/' from politicians where full_name = 'Patty Murray';

alter table stocks enable row level security;
alter table trades enable row level security;
create policy "Public read access" on stocks for select using (true);
create policy "Public read access" on trades for select using (true);
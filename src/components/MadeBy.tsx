const MadeBy = () => {
  return (
    <a
      className="block w-10 h-10 rounded-full bg-white p-1 duration opacity-90 hover:opacity-100"
      title="Made by vdeantoni.com"
      href="https://vdeantoni.com"
      target="_blank"
      rel="noreferrer"
    >
      <img
        src="/vdeantoni.png"
        alt="Picture of the author"
        width={"100%"}
        height={"100%"}
      />
    </a>
  );
};

export default MadeBy;

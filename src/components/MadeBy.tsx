const MadeBy = () => {
  return (
    <div className="fixed bottom-3 right-1">
      <a
        className="block w-10 h-10 rounded-full bg-white p-1 duration opacity-90 hover:opacity-100"
        title="Made by vdeantoni.com"
        href="http://vdeantoni.com"
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
    </div>
  );
};

export default MadeBy;
